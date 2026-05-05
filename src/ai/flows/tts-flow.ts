'use server';
/**
 * @fileOverview A Text-to-Speech (TTS) AI flow.
 *
 * - textToSpeech - Converts a string of text into playable audio.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import wav from 'wav';

const TTSInputSchema = z.object({
  text: z.string().describe('The text to convert to speech.'),
});
export type TTSInput = z.infer<typeof TTSInputSchema>;

const TTSOutputSchema = z.object({
  audio: z.string().describe("A URL to the generated audio. Can be a Firebase Storage public URL (https://...) or a data URI fallback (data:audio/wav;base64,...)."),
});
export type TTSOutput = z.infer<typeof TTSOutputSchema>;

export async function textToSpeech(input: TTSInput): Promise<TTSOutput> {
  return ttsFlow(input);
}

const MAX_CHUNK_LENGTH = 2000;

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

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

import { getCachedAudio, cacheAudio } from '@/lib/audio-cache';

const ttsFlow = ai.defineFlow(
  {
    name: 'ttsFlow',
    inputSchema: TTSInputSchema,
    outputSchema: TTSOutputSchema,
  },
  async (input) => {
    const voiceName = 'Fenrir';
    // Limpiar el texto: eliminar números de versículos (ej: "1 ", "2 ") para que no se lean
    const normalizedText = input.text.trim().replace(/\b\d+\b/g, '');
    
    // 1. Intentar obtener del cache
    const cachedUrl = await getCachedAudio(normalizedText, voiceName);
    if (cachedUrl) {
      return { audio: cachedUrl };
    }

    // 2. Si no hay cache, generar fragmentos en paralelo
    const chunks = splitTextIntoChunks(normalizedText);
    console.log(`TTS (Gemini): Cache miss. Texto dividido en ${chunks.length} fragmento(s) (${normalizedText.length} caracteres total)`);

    const pcmBuffers = await Promise.all(chunks.map(async (chunk, i) => {
      console.log(`TTS (Gemini): Iniciando fragmento ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      let media;
      let retries = 3;
      while (retries > 0) {
        try {
          const result = await ai.generate({
            model: 'googleai/gemini-2.5-flash-preview-tts',
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
            prompt: chunk,
          });
          media = result.media;
          break; // Éxito
        } catch (error: any) {
          console.warn(`⚠️ TTS (Gemini): Falló fragmento ${i + 1}. Reintentando... (${3 - retries + 1}/3)`);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!media || !media.url) {
        throw new Error(`No media returned from TTS model on chunk ${i + 1}`);
      }

      const wavBuffer = Buffer.from(
        media.url.substring(media.url.indexOf(',') + 1),
        'base64'
      );
      
      let dataOffset = 44;
      for (let j = 0; j < Math.min(100, wavBuffer.length - 4); j++) {
        if (wavBuffer[j] === 0x64 && wavBuffer[j+1] === 0x61 && wavBuffer[j+2] === 0x74 && wavBuffer[j+3] === 0x61) {
          dataOffset = j + 8;
          break;
        }
      }
      return wavBuffer.subarray(dataOffset);
    }));

    // Concatenar todos los buffers PCM puros
    const combinedPcmBuffer = Buffer.concat(pcmBuffers);
    
    // Convertir a WAV
    const wavBase64 = await toWav(combinedPcmBuffer);
    
    // 3. Guardar en cache para futuras solicitudes
    const downloadUrl = await cacheAudio(normalizedText, voiceName, wavBase64);

    const sizeKB = (Buffer.byteLength(wavBase64, 'base64') / 1024).toFixed(1);
    console.log(`TTS (Gemini): Audio generado y cacheado - ${sizeKB} KB`);

    return {
      audio: downloadUrl,
    };
  }
);
