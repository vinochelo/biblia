'use server';
/**
 * @fileOverview A biblical dictionary AI agent.
 *
 * - defineTerm - A function that handles the biblical term definition process.
 * - DefineTermInput - The input type for the defineTerm function.
 * - DefineTermOutput - The return type for the defineTerm function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DefineTermInputSchema = z.object({
  term: z.string().describe('The word or phrase to be defined in a biblical context.'),
  context: z.string().optional().describe('The surrounding text or verse for additional context.'),
});
export type DefineTermInput = z.infer<typeof DefineTermInputSchema>;

const DefineTermOutputSchema = z.object({
  term: z.string().describe('The term that was defined.'),
  definition: z.string().describe('The definition of the term in a biblical context, including etymology and significance if available. Should be in Spanish.'),
  reference: z.string().optional().describe('A relevant Bible verse related to the term. Should be in Spanish.'),
});
export type DefineTermOutput = z.infer<typeof DefineTermOutputSchema>;

export async function defineTerm(input: DefineTermInput): Promise<DefineTermOutput> {
  return defineTermFlow(input);
}

const prompt = ai.definePrompt({
  name: 'defineTermPrompt',
  input: {schema: DefineTermInputSchema},
  output: {schema: DefineTermOutputSchema},
  prompt: `You are an expert theologian and biblical dictionary. Your task is to provide a clear and concise definition for the given term, in Spanish.

You must explain the term's meaning within its biblical context. If known, include its etymology (Hebrew or Greek root) and its theological significance.
Keep the definition accessible to a layperson.

If a context verse is provided, use it to tailor the definition.

Term to define: {{{term}}}
{{#if context}}
Context from the verse: {{{context}}}
{{/if}}

Provide your answer in Spanish.`,
});

const defineTermFlow = ai.defineFlow(
  {
    name: 'defineTermFlow',
    inputSchema: DefineTermInputSchema,
    outputSchema: DefineTermOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

    