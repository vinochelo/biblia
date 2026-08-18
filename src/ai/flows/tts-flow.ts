'use server';

import { ai } from '@/ai/genkit';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { getCachedAudio, cacheAudio, getCacheKey, cloudinary, ensureCloudinaryConfig } from '@/lib/audio-cache';

const TTSInputSchema = z.object({
  text: z.string().describe('The text to convert to speech.'),
});
export type TTSInput = z.infer<typeof TTSInputSchema>;

const TTSOutputSchema = z.object({
  audio: z.string().describe('URL pública del audio (https://...) o data URI fallback (data:audio/wav;base64,...).'),
});
export type TTSOutput = z.infer<typeof TTSOutputSchema>;

const MAX_CHUNK_LENGTH = 800;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_VOICE = 'Fenrir';
const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_SAMPLE_WIDTH = 2;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;

const VERSE_NUMBER_PATTERN = /(?:^|\s)\d{1,3}\s/g;

function getApiKeys(): string[] {
  const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return envKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
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
    .replace(VERSE_NUMBER_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function textToSpeech(input: TTSInput): Promise<TTSOutput> {
  return ttsFlow(input);
}

function splitTextIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) {
    return [text];
  }

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
      if (searchArea[i] === '.' || searchArea[i] === '?' || searchArea[i] === '!' || searchArea[i] === '\n') {
        splitIndex = i + 1;
        break;
      }
    }

    if (splitIndex === -1) {
      splitIndex = searchArea.lastIndexOf(' ');
    }

    if (splitIndex === -1) {
      splitIndex = MAX_CHUNK_LENGTH;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks.filter(c => c.length > 0);
}

function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitDepth: number = 16
): Buffer {
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

async function toWav(
  pcmData: Buffer,
  channels: number = TTS_CHANNELS,
  rate: number = TTS_SAMPLE_RATE,
  sampleWidth: number = TTS_SAMPLE_WIDTH
): Promise<string> {
  if (pcmData.length === 0) {
    throw new Error('No se puede crear WAV a partir de un buffer PCM vacío');
  }
  const wavBuffer = pcmToWav(pcmData, rate, channels, sampleWidth * 8);
  return wavBuffer.toString('base64');
}

async function generateSingleChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<Buffer> {
  console.log(`TTS (Gemini): Iniciando fragmento ${chunkIndex + 1}/${totalChunks} (${chunk.length} chars)`);

  let pcmBuffer: Buffer | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const apiKey = getNextApiKey();
      if (!apiKey) {
        throw new Error('No hay claves API de Gemini configuradas');
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: chunk }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
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
        throw new Error("La API no retornó datos de audio inlineData.");
      }

      pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
      break;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const is429 = errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
      console.warn(
        `TTS (Gemini): Falló fragmento ${chunkIndex + 1} (intento ${attempt}/${MAX_RETRIES})${is429 ? ' [RATE LIMIT]' : ''}: ${errorMsg.substring(0, 200)}`
      );

      if (attempt === MAX_RETRIES) {
        throw new Error(`TTS falló en fragmento ${chunkIndex + 1} después de ${MAX_RETRIES} intentos: ${errorMsg.substring(0, 300)}`);
      }

      const delayMs = is429 ? 3000 * attempt : RETRY_BASE_DELAY_MS * attempt;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  if (!pcmBuffer) {
    throw new Error(`TTS no retornó audio para el fragmento ${chunkIndex + 1}`);
  }

  return pcmBuffer;
}


const ttsFlow = ai.defineFlow(
  {
    name: 'ttsFlow',
    inputSchema: TTSInputSchema,
    outputSchema: TTSOutputSchema,
  },
  async (input) => {
    const normalizedText = normalizeTextForTTS(input.text);

    if (!normalizedText) {
      throw new Error('El texto normalizado está vacío. No se puede generar audio.');
    }

    // 1. Check if already cached
    const cachedUrl = await getCachedAudio(normalizedText, TTS_VOICE);
    if (cachedUrl) {
      return { audio: cachedUrl };
    }

    // 2. Try ElevenLabs premium generation for the whole text in one call
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (elevenLabsApiKey) {
      try {
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // Sarah prebuilt
        console.log(`TTS (Genkit Flow): Intentando generación premium completa con ElevenLabs (voz: ${voiceId})...`);
        
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
          console.log("TTS (Genkit Flow): Generación ElevenLabs exitosa. Guardando en caché...");
          
          const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, mp3Base64);
          return { audio: downloadUrl };
        } else {
          const errText = await response.text();
          console.warn(`TTS (Genkit Flow): ElevenLabs no disponible (status: ${response.status}). Usando fallback de Gemini por fragmentos...`);
        }
      } catch (e) {
        console.error("TTS (Genkit Flow): Error llamando a ElevenLabs, usando fallback de Gemini...", e);
      }
    }

    // 3. Fallback: Split text and generate chunk-by-chunk using Gemini
    const chunks = splitTextIntoChunks(normalizedText);
    console.log(`TTS (Gemini): Cache miss. Texto dividido en ${chunks.length} fragmento(s) (${normalizedText.length} caracteres) - Procesando en paralelo con escalonamiento de 2s`);

    const pcmBuffers = await Promise.all(
      chunks.map(async (chunk, index) => {
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * 2000));
        }
        return generateSingleChunk(chunk, index, chunks.length);
      })
    );

    // Concatenar todos los buffers PCM puros
    const combinedPcmBuffer = Buffer.concat(pcmBuffers);

    // Convertir a WAV
    const wavBase64 = await toWav(combinedPcmBuffer);
    
    // Guardar en cache
    const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, wavBase64);

    const sizeKB = (Buffer.byteLength(wavBase64, 'base64') / 1024).toFixed(1);
    console.log(`TTS (Gemini): Audio generado y cacheado - ${sizeKB} KB`);

    return {
      audio: downloadUrl,
    };
  }
);

export async function prepareTTS(text: string): Promise<{
  status: 'cached' | 'needs_generation';
  audio?: string;
  cacheKey?: string;
  sessionId?: string;
  chunks?: string[];
}> {
  const normalizedText = normalizeTextForTTS(text);
  if (!normalizedText) {
    throw new Error('El texto está vacío.');
  }

  const cacheKey = getCacheKey(normalizedText, TTS_VOICE);
  const cachedUrl = await getCachedAudio(normalizedText, TTS_VOICE);
  if (cachedUrl) {
    return { status: 'cached', audio: cachedUrl };
  }

  const chunks = splitTextIntoChunks(normalizedText);
  return {
    status: 'needs_generation',
    cacheKey,
    sessionId: cacheKey, // We use the cacheKey as the sessionId since it's unique and stable
    chunks,
  };
}

export async function generateTTSChunk(
  sessionId: string,
  chunkText: string,
  chunkIndex: number,
  totalChunks: number
): Promise<{ success: boolean; pcmBase64: string }> {
  // 1. Generate single chunk (returns raw PCM Buffer)
  const pcmBuffer = await generateSingleChunk(chunkText, chunkIndex, totalChunks);
  return { success: true, pcmBase64: pcmBuffer.toString("base64") };
}

export async function finalizeTTS(
  sessionId: string,
  text: string,
  pcmParts: string[]
): Promise<{ audio: string }> {
  const normalizedText = normalizeTextForTTS(text);
  if (!normalizedText) {
    throw new Error("Texto normalizado vacío para finalizar TTS.");
  }
  if (!pcmParts || pcmParts.length === 0) {
    throw new Error("No se recibieron partes PCM para finalizar el audio.");
  }

  // 1. Concatenate all PCM buffers in memory
  const pcmBuffers = pcmParts.map((base64: string) => Buffer.from(base64, "base64"));
  const combinedPcmBuffer = Buffer.concat(pcmBuffers);

  // 2. Convert combined PCM to WAV Base64
  const wavBase64 = await toWav(combinedPcmBuffer);

  // 3. Cache audio (uploads final WAV to Cloudinary and saves URL in Firebase RTDB)
  const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, wavBase64);

  return { audio: downloadUrl };
}

