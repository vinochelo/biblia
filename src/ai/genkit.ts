import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Lógica de rotación de múltiples API Keys
// Puedes poner en tu .env.local: GEMINI_API_KEYS=key1,key2,key3
const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const keysArray = envKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
const randomKey = keysArray.length > 0 ? keysArray[Math.floor(Math.random() * keysArray.length)] : undefined;

// Forzamos a Genkit a usar la clave elegida
if (randomKey) {
  process.env.GEMINI_API_KEY = randomKey;
  console.log("🔑 Genkit inicializado con una API Key rotada.");
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
