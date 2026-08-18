import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getNextGeminiApiKey } from '@/lib/gemini-keys';

function getInitialKey(): string | undefined {
  try {
    return getNextGeminiApiKey();
  } catch {
    return process.env.GEMINI_API_KEY;
  }
}

const initialKey = getInitialKey();
if (initialKey) {
  process.env.GEMINI_API_KEY = initialKey;
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: initialKey })],
  model: 'googleai/gemini-2.5-flash',
});

