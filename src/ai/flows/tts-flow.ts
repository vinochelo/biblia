'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import wav from 'wav';
import { getCachedAudio, cacheAudio } from '@/lib/audio-cache';

const TTSInputSchema = z.object({
  text: z.string().describe('The text to convert to speech.'),
});
export type TTSInput = z.infer<typeof TTSInputSchema>;

const TTSOutputSchema = z.object({
  audio: z.string().describe('URL pública del audio (https://...) o data URI fallback (data:audio/wav;base64,...).'),
});
export type TTSOutput = z.infer<typeof TTSOutputSchema>;

const MAX_CHUNK_LENGTH = 2000;
const TTS_MODEL = 'googleai/gemini-2.5-flash';
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

let currentKeyIndex = 0;

function getNextApiKey(): string | undefined {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) return undefined;
  const key = apiKeys[currentKeyIndex % apiKeys.length];
  currentKeyIndex++;
  return key;
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

async function toWav(
  pcmData: Buffer,
  channels: number = TTS_CHANNELS,
  rate: number = TTS_SAMPLE_RATE,
  sampleWidth: number = TTS_SAMPLE_WIDTH
): Promise<string> {
  if (pcmData.length === 0) {
    throw new Error('No se puede crear WAV a partir de un buffer PCM vacío');
  }

  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: Buffer[] = [];
    writer.on('error', reject);
    writer.on('data', (d: Buffer) => {
      bufs.push(d);
    });
    writer.on('end', () => {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
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
      if (nextKey) {
        process.env.GEMINI_API_KEY = nextKey;
        const keys = getApiKeys();
        console.log(`TTS (Gemini): Usando API Key #${((currentKeyIndex - 1) % keys.length) + 1}/${keys.length}`);
      }

      const result = await ai.generate({
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

    const cachedUrl = await getCachedAudio(normalizedText, TTS_VOICE);
    if (cachedUrl) {
      return { audio: cachedUrl };
    }

    const chunks = splitTextIntoChunks(normalizedText);
    console.log(`TTS (Gemini): Cache miss. Texto dividido en ${chunks.length} fragmento(s) (${normalizedText.length} caracteres) - Procesando secuencialmente`);

    const pcmBuffers: Buffer[] = [];
    const hasMultipleKeys = getApiKeys().length > 1;

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        // Si hay múltiples API Keys rotando, el delay puede ser menor (100ms)
        // Si hay una sola key, esperamos INTER_CHUNK_DELAY_MS (1000ms)
        const delayMs = hasMultipleKeys ? 100 : INTER_CHUNK_DELAY_MS;
        console.log(`TTS (Gemini): Esperando ${delayMs}ms antes del fragmento ${i + 1}/${chunks.length}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const pcmBuffer = await generateSingleChunk(chunks[i], i, chunks.length);
      pcmBuffers.push(pcmBuffer);
    }

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
