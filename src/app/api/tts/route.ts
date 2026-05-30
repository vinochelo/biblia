import { NextRequest, NextResponse } from "next/server";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { getCachedAudio, cacheAudio, getCacheKey } from "@/lib/audio-cache";

const MAX_CHUNK_LENGTH = 1500;
const TTS_MODEL = "googleai/gemini-3.1-flash-tts-preview";
const TTS_VOICE = "Fenrir";
const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_SAMPLE_WIDTH = 2;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

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

function extractPcmFromDataUri(dataUri: string): Buffer {
  const base64Payload = dataUri.substring(dataUri.indexOf(",") + 1);
  const decodedBuffer = Buffer.from(base64Payload, "base64");
  if (decodedBuffer.length < 12) {
    throw new Error(`Buffer de audio demasiado pequeño (${decodedBuffer.length} bytes)`);
  }
  const isRiff =
    decodedBuffer[0] === 0x52 && decodedBuffer[1] === 0x49 &&
    decodedBuffer[2] === 0x46 && decodedBuffer[3] === 0x46;
  if (isRiff) {
    for (let j = 12; j < Math.min(200, decodedBuffer.length - 8); j += 4) {
      if (
        decodedBuffer[j] === 0x64 && decodedBuffer[j + 1] === 0x61 &&
        decodedBuffer[j + 2] === 0x74 && decodedBuffer[j + 3] === 0x61
      ) {
        const chunkSize = decodedBuffer.readUInt32LE(j + 4);
        return decodedBuffer.subarray(j + 8, j + 8 + chunkSize);
      }
    }
    return decodedBuffer.subarray(44);
  }
  return decodedBuffer;
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
 * POST /api/tts/check-cache
 * Body: { text: string }
 * Returns: { status: 'cached', audio: string } | { status: 'needs_generation', chunks: string[] }
 */
async function handleCheckCache(body: any) {
  const text = body.text;
  if (!text) return NextResponse.json({ error: "Texto requerido" }, { status: 400 });

  const normalizedText = normalizeTextForTTS(text);
  if (!normalizedText) return NextResponse.json({ error: "Texto vacío" }, { status: 400 });

  // 1. Check if already cached
  const cachedUrl = await getCachedAudio(normalizedText, TTS_VOICE);
  if (cachedUrl) {
    return NextResponse.json({ status: "cached", audio: cachedUrl });
  }

  // 2. Try ElevenLabs premium generation for the whole text in one call
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsApiKey) {
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // Sarah prebuilt
      console.log(`TTS API: Intentando generación premium completa con ElevenLabs (voz: ${voiceId})...`);
      
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
        console.warn(`TTS API: ElevenLabs no disponible (status: ${response.status}). Usando fallback de Gemini...`);
      }
    } catch (e) {
      console.error("TTS API: Error llamando a ElevenLabs, usando fallback de Gemini...", e);
    }
  }

  // 3. Fallback: Split text and return chunks for Gemini generation
  const chunks = splitTextIntoChunks(normalizedText);
  return NextResponse.json({ status: "needs_generation", chunks });
}

/**
 * POST /api/tts/generate-chunk
 * Body: { chunkText: string, chunkIndex: number, totalChunks: number }
 * Returns: { pcmBase64: string }
 */
async function handleGenerateChunk(body: any) {
  const { chunkText, chunkIndex, totalChunks } = body;
  if (!chunkText) return NextResponse.json({ error: "chunkText requerido" }, { status: 400 });

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
  }

  let media: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const nextKey = getNextApiKey();
      const chunkAi = genkit({ plugins: [googleAI({ apiKey: nextKey })] });
      const result = await chunkAi.generate({
        model: TTS_MODEL,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: TTS_VOICE },
            },
          },
        },
        prompt: chunkText,
      });

      if (!result.media?.url) {
        throw new Error("API no retornó audio");
      }
      media = result.media;
      break;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const is429 = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Resource has been exhausted");
      console.warn(`TTS chunk ${chunkIndex + 1}/${totalChunks} (intento ${attempt}): ${errorMsg.substring(0, 200)}`);

      if (attempt === MAX_RETRIES) {
        return NextResponse.json(
          { error: `TTS falló chunk ${chunkIndex + 1}: ${errorMsg.substring(0, 300)}`, retryable: is429 },
          { status: is429 ? 429 : 500 }
        );
      }

      const delayMs = is429 ? 5000 * attempt : RETRY_BASE_DELAY_MS * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (!media?.url) {
    return NextResponse.json({ error: "No se generó audio" }, { status: 500 });
  }

  const pcmBuffer = extractPcmFromDataUri(media.url);
  return NextResponse.json({ pcmBase64: pcmBuffer.toString("base64") });
}

/**
 * POST /api/tts/finalize
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
