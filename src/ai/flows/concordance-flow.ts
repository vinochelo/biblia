'use server';
/**
 * @fileOverview A biblical concordance AI agent.
 *
 * - findConcordance - A function that handles finding related bible verses.
 * - ConcordanceInput - The input type for the findConcordance function.
 * - ConcordanceOutput - The return type for the findConcordance function.
 */

import { z } from 'zod';
import { executeWithGeminiKeyRotation } from '@/lib/gemini-keys';

const ConcordanceInputSchema = z.object({
  term: z.string().describe('The word or phrase to find concordances for.'),
  context: z.string().optional().describe('The original verse or context to provide more insight and avoid self-references.'),
});
export type ConcordanceInput = z.infer<typeof ConcordanceInputSchema>;

const ConcordanceVerseSchema = z.object({
  reference: z.string().describe('The Bible verse reference (e.g., Juan 3:16). Should be in Spanish.'),
  text: z.string().describe('The full text of the verse. Should be in Spanish.'),
});

const ConcordanceOutputSchema = z.object({
  verses: z.array(ConcordanceVerseSchema).describe('An array of related Bible verses.'),
});
export type ConcordanceOutput = z.infer<typeof ConcordanceOutputSchema>;

export async function findConcordance(input: ConcordanceInput): Promise<ConcordanceOutput> {
  const promptText = `You are an expert biblical concordance. Your task is to find verses throughout the Bible that are thematically or linguistically related to the given term: "${input.term}".
Provide up to 5-7 relevant verses.
Do not include the original verse if it is provided in the context.
All responses (references and text) must be in Spanish.
${input.context ? `Original context (do not include in results): ${input.context}` : ''}

Respond using this exact JSON schema:
{
  "verses": [
    {
      "reference": "Libro Capítulo:Versículo (e.g., Juan 3:16)",
      "text": "Texto completo del versículo en español"
    }
  ]
}`;

  return executeWithGeminiKeyRotation(
    async (apiKey) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error('La API de Gemini no retornó texto.');
      }

      const parsed = JSON.parse(rawJson);
      return {
        verses: Array.isArray(parsed.verses) ? parsed.verses : [],
      };
    },
    { label: `Concordance: ${input.term}` }
  );
}

