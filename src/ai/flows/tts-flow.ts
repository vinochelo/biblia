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
  audio: z.string().describe("A data URI of the generated audio in WAV format. Format: 'data:audio/wav;base64,<encoded_data>'"),
});
export type TTSOutput = z.infer<typeof TTSOutputSchema>;

export async function textToSpeech(input: TTSInput): Promise<TTSOutput> {
  return ttsFlow(input);
}

const MAX_CHUNK_LENGTH = 4500;

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
    const normalizedText = input.text.trim();
    
    // 1. Intentar obtener del cache
    const cachedUrl = await getCachedAudio(normalizedText, voiceName);
    if (cachedUrl) {
      return { audio: cachedUrl };
    }

    // 2. Si no hay cache, generar fragmentos
    const chunks = splitTextIntoChunks(normalizedText);
    console.log(`TTS (Gemini): Cache miss. Texto dividido en ${chunks.length} fragmento(s) (${normalizedText.length} caracteres total)`);

    const pcmBuffers: Buffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`TTS (Gemini): Generando fragmento ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
      
      const { media } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-preview-tts',
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
        prompt: chunks[i],
      });

      if (!media || !media.url) {
        throw new Error(`No media returned from TTS model on chunk ${i + 1}`);
      }

      // Extraer datos PCM desde la URL base64 devuelta
      const audioBuffer = Buffer.from(
        media.url.substring(media.url.indexOf(',') + 1),
        'base64'
      );
      pcmBuffers.push(audioBuffer);
    }

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
