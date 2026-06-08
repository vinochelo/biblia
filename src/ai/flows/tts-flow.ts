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

const MAX_CHUNK_LENGTH = 1500;
const TTS_MODEL = 'googleai/gemini-3.1-flash-tts-preview';
const TTS_VOICE = 'Fenrir';
const TTS_SAMPLE_RATE = 24000;
const TTS_CHANNELS = 1;
const TTS_SAMPLE_WIDTH = 2;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 2000;
const INTER_CHUNK_DELAY_MS = 1000;

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

function extractRetryDelayMs(errorMsg: string): number | null {
  const match = errorMsg.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 1000;
  }
  return null;
}

function normalizeTextForTTS(text: string): string {
  return text
    .trim()
    .replace(VERSE_NUMBER_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function textToSpeech(input: TTSInput): Promise<TTSOutput> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
  }
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

function extractPcmFromDataUri(dataUri: string): Buffer {
  const base64Payload = dataUri.substring(dataUri.indexOf(',') + 1);
  const decodedBuffer = Buffer.from(base64Payload, 'base64');

  if (decodedBuffer.length < 12) {
    throw new Error(`Buffer de audio demasiado pequeño (${decodedBuffer.length} bytes)`);
  }

  const isRiff =
    decodedBuffer[0] === 0x52 && decodedBuffer[1] === 0x49 &&
    decodedBuffer[2] === 0x46 && decodedBuffer[3] === 0x46;

  if (isRiff) {
    const isData =
      decodedBuffer[36] === 0x64 && decodedBuffer[37] === 0x61 &&
      decodedBuffer[38] === 0x74 && decodedBuffer[39] === 0x61;

    if (isData) {
      const dataSize = decodedBuffer.readUInt32LE(40);
      return decodedBuffer.subarray(44, 44 + dataSize);
    }

    for (let j = 12; j < Math.min(200, decodedBuffer.length - 8); j += 4) {
      if (
        decodedBuffer[j] === 0x64 && decodedBuffer[j + 1] === 0x61 &&
        decodedBuffer[j + 2] === 0x74 && decodedBuffer[j + 3] === 0x61
      ) {
        const chunkSize = decodedBuffer.readUInt32LE(j + 4);
        return decodedBuffer.subarray(j + 8, j + 8 + chunkSize);
      }
    }

    console.warn('TTS: Header RIFF encontrado pero sin chunk "data", usando fallback offset=44');
    return decodedBuffer.subarray(44);
  }

  console.log('TTS: Audio PCM puro detectado (sin header RIFF), usando buffer completo');
  return decodedBuffer;
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

  let media: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const nextKey = getNextApiKey();
      const keys = getApiKeys();
      const keyIndex = nextKey ? keys.indexOf(nextKey) : -1;
      console.log(`TTS (Gemini): Fragmento ${chunkIndex + 1}/${totalChunks} (intento ${attempt}) usando API Key #${keyIndex >= 0 ? keyIndex + 1 : 'default'}/${keys.length}`);

      const chunkAi = genkit({
        plugins: [googleAI({ apiKey: nextKey })],
      });

      const result = await chunkAi.generate({
        model: TTS_MODEL,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: TTS_VOICE },
            },
          },
        },
        prompt: chunk,
      });
      if (!result.media?.url) {
        throw new Error("La API no retornó la URL del contenido de audio (posible respuesta vacía o bloqueo de seguridad transitorio).");
      }
      media = result.media;
      break;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const is429 = errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota');
      console.warn(
        `TTS (Gemini): Falló fragmento ${chunkIndex + 1} (intento ${attempt}/${MAX_RETRIES})${is429 ? ' [RATE LIMIT]' : ''}: ${errorMsg.substring(0, 200)}`
      );

      if (attempt === MAX_RETRIES) {
        throw new Error(`TTS falló en fragmento ${chunkIndex + 1} después de ${MAX_RETRIES} intentos: ${errorMsg.substring(0, 300)}`);
      }

      let delayMs: number;
      if (is429) {
        const serverRetryDelay = extractRetryDelayMs(errorMsg);
        if (serverRetryDelay) {
          delayMs = serverRetryDelay;
          console.log(`TTS (Gemini): Respetando retry del servidor: esperando ${Math.round(delayMs / 1000)}s`);
        } else {
          delayMs = 60000 * attempt;
          console.log(`TTS (Gemini): Rate limit sin retry delay, esperando ${Math.round(delayMs / 1000)}s (intento ${attempt})`);
        }
      } else {
        delayMs = RETRY_BASE_DELAY_MS * attempt;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  if (!media?.url) {
    throw new Error(`TTS no retornó audio para el fragmento ${chunkIndex + 1}`);
  }

  return extractPcmFromDataUri(media.url);
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
): Promise<{ success: boolean; url?: string }> {
  // 1. Generate single chunk (returns raw PCM Buffer)
  const pcmBuffer = await generateSingleChunk(chunkText, chunkIndex, totalChunks);
  
  // 2. Convert raw PCM Buffer to WAV Buffer
  const wavBuffer = pcmToWav(pcmBuffer, TTS_SAMPLE_RATE, TTS_CHANNELS, TTS_SAMPLE_WIDTH * 8);
  const wavBase64 = wavBuffer.toString('base64');
  
  // 3. Upload chunk to Cloudinary
  if (!ensureCloudinaryConfig()) {
    throw new Error("Cloudinary credentials are not configured in environment variables.");
  }
  
  const publicId = `bible_audio_chunks/${sessionId}/chunk_${chunkIndex}`;
  console.log(`TTS Server Actions: Uploading chunk ${chunkIndex + 1}/${totalChunks} to Cloudinary under public ID: ${publicId}`);
  
  const uploadResponse = await cloudinary.uploader.upload(
    `data:audio/wav;base64,${wavBase64}`,
    {
      resource_type: "video",
      public_id: publicId,
      overwrite: true,
    }
  );
  
  return { success: true, url: uploadResponse.secure_url };
}

export async function finalizeTTS(
  sessionId: string,
  text: string,
  totalChunks: number
): Promise<{ audio: string }> {
  const normalizedText = normalizeTextForTTS(text);
  
  const { CLOUDINARY_CLOUD_NAME } = process.env;
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME is not configured.");
  }

  const pcmBuffers: Buffer[] = [];
  
  // 1. Download all generated chunks and extract their PCM buffers
  for (let i = 0; i < totalChunks; i++) {
    const chunkUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/bible_audio_chunks/${sessionId}/chunk_${i}.wav`;
    console.log(`TTS Server Actions: Downloading chunk ${i + 1}/${totalChunks} from ${chunkUrl}`);
    
    let downloadedBuffer: Buffer;
    try {
      const res = await fetch(chunkUrl);
      if (!res.ok) {
        throw new Error(`Failed to download chunk ${i} (status: ${res.status})`);
      }
      const arrayBuffer = await res.arrayBuffer();
      downloadedBuffer = Buffer.from(arrayBuffer);
    } catch (err: any) {
      throw new Error(`Error descargando fragmento ${i + 1}: ${err.message || err}`);
    }
    
    const pcmData = extractPcmFromDataUri(`data:audio/wav;base64,${downloadedBuffer.toString('base64')}`);
    pcmBuffers.push(pcmData);
  }
  
  // 2. Concatenate PCM
  const combinedPcmBuffer = Buffer.concat(pcmBuffers);
  
  // 3. Convert to WAV
  const wavBase64 = await toWav(combinedPcmBuffer);
  
  // 4. Cache audio (uploads final WAV to Cloudinary and saves URL in Firebase RTDB)
  const downloadUrl = await cacheAudio(normalizedText, TTS_VOICE, wavBase64);
  
  // 5. Clean up temporary chunks asynchronously
  const deletePromises = [];
  for (let i = 0; i < totalChunks; i++) {
    const publicId = `bible_audio_chunks/${sessionId}/chunk_${i}`;
    deletePromises.push(
      cloudinary.uploader.destroy(publicId, { resource_type: "video" })
        .catch(err => console.error(`Failed to delete temporary chunk ${publicId}:`, err))
    );
  }
  
  // Do not block response for deletion
  Promise.all(deletePromises).then(() => {
    console.log(`TTS Server Actions: Cleaned up temporary chunks for session ${sessionId}`);
  });
  
  return { audio: downloadUrl };
}

