import { NextRequest, NextResponse } from "next/server";
import { getCachedAudio, cacheAudio, getCacheKey, isGeneratingAudio, setGeneratingLock, clearGeneratingLock } from "@/lib/audio-cache";

const MAX_CHUNK_LENGTH = 800;
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Fenrir";
const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_SAMPLE_WIDTH = 2;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;

const VERSE_NUMBER_PATTERN = /(?:^|\s)\d{1,3}\s/g;

function getApiKeys(): string[] {
  const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return envKeys.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
}

function getNextApiKey(): string | undefined {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * apiKeys.length);
  return apiKeys[randomIndex];
}

function normalizeTextForTTS(text: string): string {
  return text
    .trim()
    .replace(VERSE_NUMBER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_LENGTH) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = -1;
    const searchArea = remaining.substring(0, MAX_CHUNK_LENGTH);
    for (let i = searchArea.length - 1; i >= 0; i--) {
      if (".?!\n".includes(searchArea[i])) {
        splitIndex = i + 1;
        break;
      }
    }
    if (splitIndex === -1) splitIndex = searchArea.lastIndexOf(" ");
    if (splitIndex === -1) splitIndex = MAX_CHUNK_LENGTH;
    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }
  return chunks.filter((c) => c.length > 0);
}

function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitDepth: number = 16): Buffer {
  const header = Buffer.alloc(44);
  
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28);
  header.writeUInt16LE(numChannels * (bitDepth / 8), 32);
  header.writeUInt16LE(bitDepth, 34);
  
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  
  return Buffer.concat([header, pcmBuffer]);
}

async function toWav(pcmData: Buffer): Promise<string> {
  if (pcmData.length === 0) throw new Error("PCM buffer vacío");
  const wavBuffer = pcmToWav(pcmData, TTS_SAMPLE_RATE, TTS_CHANNELS, TTS_SAMPLE_WIDTH * 8);
  return wavBuffer.toString("base64");
}

/**
 * POST /api/tts?action=check-cache
 * Body: { text: string, generateIfMissing?: boolean }
 * Returns: 
 *   - { status: 'cached', audio: string }
 *   - { status: 'in_progress' } (when another user or task is generating it)
 *   - { status: 'not_cached' } (when generateIfMissing is false and not in cache)
 *   - { status: 'needs_generation', chunks: string[] } (when generateIfMissing is true and needs chunks)
 */
async function handleCheckCache(body: any) {
  const { text, generateIfMissing = false } = body;
  if (!text) return NextResponse.json({ error: "Texto requerido" }, { status: 400 });

  const normalizedText = normalizeTextForTTS(text);
  if (!normalizedText) return NextResponse.json({ error: "Texto vacío" }, { status: 400 });

  const cacheKey = getCacheKey(normalizedText, TTS_VOICE);

  // 1. Check if already cached in Firebase RTDB
  const cachedUrl = await getCachedAudio(normalizedText, TTS_VOICE);
  if (cachedUrl) {
    return NextResponse.json({ status: "cached", audio: cachedUrl });
  }

  // 2. Check if another user/process is currently generating this audio
  const inProgress = await isGeneratingAudio(cacheKey);
  if (inProgress) {
    return NextResponse.json({ status: "in_progress" });
  }

  // If user only wanted a passive cache check (e.g. on page mount), do not start generating
  if (!generateIfMissing) {
    return NextResponse.json({ status: "not_cached" });
  }

  // 3. User explicitly requested generation: set lock
  await setGeneratingLock(cacheKey);

  // 4. Try ElevenLabs premium generation for the whole text in one call
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsApiKey) {
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // Sarah prebuilt
      console.log(`TTS API: Intentando generación premium con ElevenLabs (voz: ${voiceId})...`);
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey
        },
        body: JSON.stringify({
          text: normalizedText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85
          }
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const mp3Base64 = Buffer.from(audioBuffer).toString("base64");
        console.log("TTS API: Generación ElevenLabs exitosa. Guardando en caché...");
        
        const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, mp3Base64);
        return NextResponse.json({ status: "cached", audio: downloadUrl });
      } else {
        const errText = await response.text();
        console.warn(`TTS API: ElevenLabs no disponible (${response.status}): ${errText.substring(0, 100)}. Usando fallback de Gemini...`);
      }
    } catch (e) {
      console.error("TTS API: Error llamando a ElevenLabs, usando fallback de Gemini...", e);
    }
  }

  // 5. Fallback: Split text and return chunks for Gemini generation
  const chunks = splitTextIntoChunks(normalizedText);
  return NextResponse.json({ status: "needs_generation", chunks });
}

/**
 * POST /api/tts?action=generate-chunk
 * Body: { chunkText: string, chunkIndex: number, totalChunks: number }
 * Returns: { pcmBase64: string }
 */
async function handleGenerateChunk(body: any) {
  const { chunkText, chunkIndex, totalChunks } = body;
  if (!chunkText) return NextResponse.json({ error: "chunkText requerido" }, { status: 400 });

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "API key de Gemini no configurada" }, { status: 500 });
  }

  let pcmBuffer: Buffer | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const nextKey = getNextApiKey();
      if (!nextKey) throw new Error("No hay API key disponible");

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${nextKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: chunkText }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: TTS_VOICE },
              },
            },
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const part = data.candidates?.[0]?.content?.parts?.[0];
      if (!part?.inlineData?.data) {
        throw new Error("API no retornó datos de audio inlineData");
      }

      pcmBuffer = Buffer.from(part.inlineData.data, "base64");
      break;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const is429 = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
      console.warn(`TTS chunk ${chunkIndex + 1}/${totalChunks} (intento ${attempt}): ${errorMsg.substring(0, 150)}`);

      if (attempt === MAX_RETRIES) {
        return NextResponse.json(
          { error: `TTS falló chunk ${chunkIndex + 1}: ${errorMsg.substring(0, 300)}`, retryable: is429 },
          { status: is429 ? 429 : 500 }
        );
      }

      const delayMs = is429 ? 3000 * attempt : RETRY_BASE_DELAY_MS * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (!pcmBuffer) {
    return NextResponse.json({ error: "No se generó audio para el fragmento" }, { status: 500 });
  }

  return NextResponse.json({ pcmBase64: pcmBuffer.toString("base64") });
}

/**
 * POST /api/tts?action=finalize
 * Body: { text: string, pcmParts: string[] }
 * Returns: { audio: string }
 */
async function handleFinalize(body: any) {
  const { text, pcmParts } = body;
  if (!text || !pcmParts || !Array.isArray(pcmParts)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const normalizedText = normalizeTextForTTS(text);
  const pcmBuffers = pcmParts.map((base64: string) => Buffer.from(base64, "base64"));
  const combinedPcmBuffer = Buffer.concat(pcmBuffers);
  const wavBase64 = await toWav(combinedPcmBuffer);
  const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, wavBase64);
  return NextResponse.json({ audio: downloadUrl });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    const body = await request.json();

    switch (action) {
      case "check-cache":
        return handleCheckCache(body);
      case "generate-chunk":
        return handleGenerateChunk(body);
      case "finalize":
        return handleFinalize(body);
      default:
        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    console.error("TTS API error:", e);
    return NextResponse.json({ error: e.message || "Error interno" }, { status: 500 });
  }
}

