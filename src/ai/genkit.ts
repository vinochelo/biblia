import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const keysArray = envKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

let selectedKey: string | undefined;

if (keysArray.length === 1) {
  selectedKey = keysArray[0];
} else if (keysArray.length > 1) {
  const idx = Math.floor(Math.random() * keysArray.length);
  selectedKey = keysArray[idx];
  console.log(`Genkit: API Key ${idx + 1}/${keysArray.length} seleccionada (rotación multi-key).`);
}

if (selectedKey) {
  process.env.GEMINI_API_KEY = selectedKey;
}

if (!selectedKey) {
  console.warn("Genkit: No se encontró GEMINI_API_KEY ni GEMINI_API_KEYS en las variables de entorno.");
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
