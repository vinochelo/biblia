'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getCachedAudio, cacheAudio, getCacheKey, cloudinary, ensureCloudinaryConfig } from '@/lib/audio-cache';
import { executeWithGeminiKeyRotation } from '@/lib/gemini-keys';

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

const VERSE_NUMBER_PATTERN = /(?:^|\s)\d{1,3}\s/g;

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

  return executeWithGeminiKeyRotation(
    async (apiKey) => {
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

      return Buffer.from(part.inlineData.data, 'base64');
    },
    { label: `TTS Chunk ${chunkIndex + 1}/${totalChunks}` }
  );
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

async function synthesizeFullWithEdgeTTS(text: string, voice = 'es-MX-JorgeNeural'): Promise<string> {
  const chunks = splitTextForEdgeTTS(text, 2500);
  const mp3Buffers: Buffer[] = [];
  const { EdgeTTS } = require('@andresaya/edge-tts');

  for (const chunk of chunks) {
    const edgeTts = new EdgeTTS();
    await edgeTts.synthesize(chunk, voice);
    mp3Buffers.push(edgeTts.toBuffer());
  }

  return Buffer.concat(mp3Buffers).toString('base64');
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

    // 2. Primary engine: Microsoft Edge Neural TTS (Fast, unlimited, high-quality)
    try {
      console.log(`TTS (EdgeTTS): Generando audio con Microsoft Edge Neural TTS...`);
      const mp3Base64 = await synthesizeFullWithEdgeTTS(normalizedText, 'es-MX-JorgeNeural');

      if (mp3Base64 && mp3Base64.length > 100) {
        console.log(`TTS (EdgeTTS): Generación exitosa. Guardando en Cloudinary y Firebase...`);
        const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, mp3Base64);
        return { audio: downloadUrl };
      }
    } catch (edgeErr: any) {
      console.warn("TTS (EdgeTTS) falló, pasando a fallbacks:", edgeErr?.message || edgeErr);
    }


    // 3. Fallback 1: Try ElevenLabs premium generation if configured
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (elevenLabsApiKey) {
      try {
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // Sarah prebuilt
        console.log(`TTS (ElevenLabs Fallback): Intentando generación con ElevenLabs (voz: ${voiceId})...`);
        
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
          console.log("TTS (ElevenLabs): Generación exitosa. Guardando en caché...");
          
          const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, mp3Base64);
          return { audio: downloadUrl };
        }
      } catch (e) {
        console.error("TTS (ElevenLabs): Error llamando a ElevenLabs...", e);
      }
    }

    // 4. Fallback 2: Split text and generate chunk-by-chunk using Gemini
    const chunks = splitTextIntoChunks(normalizedText);
    console.log(`TTS (Gemini Fallback): Cache miss. Texto dividido en ${chunks.length} fragmento(s)`);

    const pcmBuffers = await Promise.all(
      chunks.map(async (chunk, index) => {
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * 2000));
        }
        return generateSingleChunk(chunk, index, chunks.length);
      })
    );

    const combinedPcmBuffer = Buffer.concat(pcmBuffers);
    const wavBase64 = await toWav(combinedPcmBuffer);
    const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, wavBase64);

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

