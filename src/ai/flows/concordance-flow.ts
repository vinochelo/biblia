'use server';
/**
 * @fileOverview A biblical concordance AI agent.
 *
 * - findConcordance - A function that handles finding related bible verses.
 * - ConcordanceInput - The input type for the findConcordance function.
 * - ConcordanceOutput - The return type for the findConcordance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return concordanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'concordancePrompt',
  input: {schema: ConcordanceInputSchema},
  output: {schema: ConcordanceOutputSchema},
  prompt: `You are an expert biblical concordance. Your task is to find verses throughout the Bible that are thematically or linguistically related to the given term. Provide up to 5-7 relevant verses.

Do not include the original verse if it is provided in the context. All responses (references and text) must be in Spanish.

Term to find connections for: {{{term}}}
{{#if context}}
Original context (do not include this in results): {{{context}}}
{{/if}}

Find relevant verses and return them in the specified format.`,
});

const concordanceFlow = ai.defineFlow(
  {
    name: 'concordanceFlow',
    inputSchema: ConcordanceInputSchema,
    outputSchema: ConcordanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output || { verses: [] };
  }
);
