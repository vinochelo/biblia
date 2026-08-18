import { NextRequest, NextResponse } from "next/server";
import { getCachedAudio, cacheAudio, getCacheKey, isGeneratingAudio, setGeneratingLock, clearGeneratingLock } from "@/lib/audio-cache";
import { executeWithGeminiKeyRotation } from "@/lib/gemini-keys";
import { getHumanAudioForChapter } from "@/lib/human-audio-map";
import { EdgeTTS } from "@andresaya/edge-tts";

const TTS_VOICE = "es-MX-JorgeNeural";
const VERSE_NUMBER_PATTERN = /(?:^|\s)\d{1,3}\s/g;

function normalizeTextForTTS(text: string): string {
  return text
    .trim()
    .replace(VERSE_NUMBER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * POST /api/tts?action=check-cache
 * Body: { text?: string, chapterId?: string, forceAi?: boolean, generateIfMissing?: boolean }
 */
async function handleCheckCache(body: any) {
  const { text, chapterId, forceAi = false, generateIfMissing = false } = body;

  // 1. If human pre-recorded audio is available and not forced to AI, return it immediately
  if (chapterId && !forceAi) {
    const humanUrl = getHumanAudioForChapter(chapterId);
    if (humanUrl) {
      return NextResponse.json({
        status: "cached",
        audio: humanUrl,
        isHuman: true,
        narrator: "Samuel Montoya (RVR 1909)",
      });
    }
  }

  if (!text) {
    return NextResponse.json({ error: "Texto o chapterId requerido" }, { status: 400 });
  }

  const normalizedText = normalizeTextForTTS(text);
  if (!normalizedText) return NextResponse.json({ error: "Texto vacío" }, { status: 400 });

  const cacheKey = getCacheKey(normalizedText, TTS_VOICE);

  // 2. Check if already cached in Firebase RTDB
  const cachedUrl = await getCachedAudio(normalizedText, TTS_VOICE);
  if (cachedUrl) {
    return NextResponse.json({ status: "cached", audio: cachedUrl, isHuman: false });
  }

  // 3. Check if another user/process is currently generating this audio
  const inProgress = await isGeneratingAudio(cacheKey);
  if (inProgress) {
    return NextResponse.json({ status: "in_progress" });
  }

  // If user only wanted a passive cache check, do not generate
  if (!generateIfMissing) {
    return NextResponse.json({ status: "not_cached" });
  }

  // 4. User clicked Play: Set lock and generate with Microsoft Edge Neural TTS
  await setGeneratingLock(cacheKey);

  try {
    console.log(`TTS API: Generando audio con Microsoft Edge Neural TTS (${TTS_VOICE})...`);
    const edgeTts = new EdgeTTS();
    await edgeTts.synthesize(normalizedText, TTS_VOICE);
    const mp3Base64 = edgeTts.toBase64();

    if (mp3Base64 && mp3Base64.length > 100) {
      console.log(`TTS API: Síntesis con EdgeTTS exitosa (${mp3Base64.length} chars base64). Guardando en Cloudinary y Firebase...`);
      const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, mp3Base64);
      return NextResponse.json({ status: "cached", audio: downloadUrl, isHuman: false });
    }
  } catch (edgeError: any) {
    console.warn("TTS API: EdgeTTS falló, intentando con fallbacks...", edgeError?.message || edgeError);
  }

  // 5. Fallback 1: ElevenLabs if configured
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsApiKey) {
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
      console.log(`TTS API: Intentando fallback con ElevenLabs (${voiceId})...`);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": elevenLabsApiKey },
        body: JSON.stringify({ text: normalizedText, model_id: "eleven_multilingual_v2" }),
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const mp3Base64 = Buffer.from(audioBuffer).toString("base64");
        const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, mp3Base64);
        return NextResponse.json({ status: "cached", audio: downloadUrl, isHuman: false });
      }
    } catch (e) {
      console.error("TTS API: Error llamando a ElevenLabs fallback:", e);
    }
  }

  // 6. Fallback 2: Gemini 2.5 Flash TTS with smart key rotation
  try {
    console.log("TTS API: Intentando fallback con Gemini 2.5 Flash TTS...");
    const pcmBase64 = await executeWithGeminiKeyRotation(async (apiKey) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: normalizedText.substring(0, 1000) }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Fenrir" } } },
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.candidates[0].content.parts[0].inlineData.data;
    }, { label: "Gemini TTS Fallback" });

    if (pcmBase64) {
      const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, pcmBase64);
      return NextResponse.json({ status: "cached", audio: downloadUrl, isHuman: false });
    }
  } catch (geminiError: any) {
    console.error("TTS API: Fallback Gemini falló:", geminiError?.message || geminiError);
    await clearGeneratingLock(cacheKey);
    return NextResponse.json(
      { error: `No se pudo generar el audio: ${geminiError?.message || geminiError}` },
      { status: 500 }
    );
  }

  await clearGeneratingLock(cacheKey);
  return NextResponse.json({ error: "Error desconocido al sintetizar audio" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "check-cache";

  try {
    const body = await request.json();
    return handleCheckCache(body);
  } catch (e: any) {
    console.error("TTS API error:", e);
    return NextResponse.json({ error: e.message || "Error interno" }, { status: 500 });
  }
}

