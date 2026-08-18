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

function splitTextForEdgeTTS(text: string, maxLen = 2500): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = -1;
    const searchArea = remaining.substring(0, maxLen);
    for (let i = searchArea.length - 1; i >= 0; i--) {
      if ('.!?\n'.includes(searchArea[i])) {
        splitIdx = i + 1;
        break;
      }
    }
    if (splitIdx === -1) splitIdx = searchArea.lastIndexOf(' ');
    if (splitIdx === -1) splitIdx = maxLen;
    chunks.push(remaining.substring(0, splitIdx).trim());
    remaining = remaining.substring(splitIdx).trim();
  }
  return chunks.filter(c => c.length > 0);
}

async function synthesizeFullWithEdgeTTS(text: string, voice = TTS_VOICE): Promise<string> {
  const chunks = splitTextForEdgeTTS(text, 2500);
  const mp3Buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const edgeTts = new EdgeTTS();
    await edgeTts.synthesize(chunk, voice);
    mp3Buffers.push(edgeTts.toBuffer());
  }

  return Buffer.concat(mp3Buffers).toString('base64');
}

async function synthesizeWithGoogleTTS(text: string, voice = 'es'): Promise<string> {
  const lang = voice.includes('ES') ? 'es-ES' : (voice.includes('AR') ? 'es-AR' : 'es');
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((currentChunk + ' ' + trimmed).length < 180) {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = trimmed;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encoded}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const ab = await res.arrayBuffer();
      buffers.push(Buffer.from(ab));
    }
  }

  if (buffers.length === 0) throw new Error("Google TTS no devolvió fragmentos");
  return Buffer.concat(buffers).toString('base64');
}

/**
 * POST /api/tts?action=check-cache
 * Body: { text?: string, chapterId?: string, forceAi?: boolean, generateIfMissing?: boolean }
 */
async function handleCheckCache(body: any) {
  const { text, chapterId, forceAi = false, generateIfMissing = false, voice } = body;
  const targetVoice = voice || TTS_VOICE;

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

  const cacheKey = getCacheKey(normalizedText, targetVoice);

  // 2. Check if already cached in Firebase RTDB
  const cachedUrl = await getCachedAudio(normalizedText, targetVoice);
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

  // 4. User clicked Play: Set lock and generate with Microsoft Edge Neural TTS or Google TTS
  await setGeneratingLock(cacheKey);

  try {
    console.log(`TTS API: Generando audio con Microsoft Edge Neural TTS (${targetVoice})...`);
    const mp3Base64 = await synthesizeFullWithEdgeTTS(normalizedText, targetVoice);

    if (mp3Base64 && mp3Base64.length > 100) {
      console.log(`TTS API: Síntesis con EdgeTTS exitosa (${mp3Base64.length} chars base64, voz: ${targetVoice}). Guardando en Cloudinary y Firebase...`);
      const downloadUrl = await cacheAudio(normalizedText, targetVoice, mp3Base64);
      return NextResponse.json({ status: "cached", audio: downloadUrl, isHuman: false });
    }
  } catch (edgeError: any) {
    console.warn("TTS API: EdgeTTS falló en el servidor, usando fallback de Google TTS...", edgeError?.message || edgeError);
    try {
      const googleMp3Base64 = await synthesizeWithGoogleTTS(normalizedText, targetVoice);
      if (googleMp3Base64 && googleMp3Base64.length > 100) {
        console.log(`TTS API: Síntesis con Google TTS exitosa (${googleMp3Base64.length} chars). Guardando en Cloudinary y Firebase...`);
        const downloadUrl = await cacheAudio(normalizedText, targetVoice, googleMp3Base64);
        return NextResponse.json({ status: "cached", audio: downloadUrl, isHuman: false });
      }
    } catch (gErr: any) {
      console.warn("TTS API: Google TTS falló también:", gErr?.message || gErr);
    }
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
        const downloadUrl = await cacheAudio(normalizedText, targetVoice, mp3Base64);
        return NextResponse.json({ status: "cached", audio: downloadUrl, isHuman: false });
      }
    } catch (e) {
      console.error("TTS API: Error llamando a ElevenLabs fallback:", e);
    }
  }

  await clearGeneratingLock(cacheKey);

  return NextResponse.json(
    {
      error: "La generación con IA no está disponible temporalmente. Puedes usar la Locución Humana oficial de Samuel Montoya o el lector de tu navegador.",
    },
    { status: 503 }
  );
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

