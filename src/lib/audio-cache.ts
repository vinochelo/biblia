import { adminDb } from "./firebase-admin";
import crypto from "crypto";
import { v2 as cloudinary } from 'cloudinary';

let cloudinaryInitialized = false;

function ensureCloudinaryConfig(): boolean {
  if (cloudinaryInitialized) return true;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn("TTS Cache: Faltan credenciales de Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).");
    return false;
  }

  try {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
    cloudinaryInitialized = true;
    return true;
  } catch (error) {
    console.error("TTS Cache: Error configurando Cloudinary:", error);
    return false;
  }
}

function getCacheKey(text: string, voice: string): string {
  return crypto.createHash('sha256').update(`${voice}:${text}`).digest('hex').substring(0, 32);
}

export async function getCachedAudio(text: string, voice: string): Promise<string | null> {
  if (!adminDb) {
    console.warn("TTS Cache: Firebase Admin DB no disponible. Cache desactivado.");
    return null;
  }

  try {
    const key = getCacheKey(text, voice);
    const snapshot = await adminDb.ref(`tts_cache/${key}`).get();

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.val();

    if (typeof data === 'string' && data.startsWith('https://')) {
      console.log(`TTS Cache: HIT para llave ${key}`);
      return data;
    }

    console.log(`TTS Cache: Dato antiguo encontrado para ${key}, se regenerará.`);
    try {
      await adminDb.ref(`tts_cache/${key}`).remove();
    } catch {
      // No bloquear si no se puede eliminar la entrada antigua
    }
    return null;
  } catch (error) {
    console.error("TTS Cache: Error al buscar en cache:", error);
    return null;
  }
}

export async function cacheAudio(text: string, voice: string, wavBase64: string): Promise<string> {
  const dataUri = `data:audio/wav;base64,${wavBase64}`;

  if (!ensureCloudinaryConfig()) {
    console.warn("TTS Cache: Retornando data URI local (sin Cloudinary). El audio puede ser pesado.");
    return dataUri;
  }

  const key = getCacheKey(text, voice);
  const MAX_UPLOAD_RETRIES = 3;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      console.log(`TTS Cache: Subiendo y comprimiendo a MP3 en Cloudinary... (intento ${attempt}/${MAX_UPLOAD_RETRIES})`);

      const uploadResponse = await cloudinary.uploader.upload(dataUri, {
        resource_type: "video",
        public_id: `bible_audio/${key}`,
        format: "mp3",
        overwrite: true,
      });

      const publicUrl = uploadResponse.secure_url;

      if (adminDb) {
        try {
          await adminDb.ref(`tts_cache/${key}`).set(publicUrl);
        } catch (dbError) {
          console.error("TTS Cache: Error guardando URL en Firebase RTDB (audio ya subido a Cloudinary):", dbError);
        }
      }

      console.log(`TTS Cache: Audio subido exitosamente → ${publicUrl}`);
      return publicUrl;
    } catch (error: unknown) {
      lastError = error;
      const isRetryable = error instanceof Error && (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('network') ||
        error.message.includes('429') ||
        error.message.includes('rate')
      );

      console.error(`TTS Cache: Error al subir a Cloudinary (intento ${attempt}/${MAX_UPLOAD_RETRIES}):`, error);

      if (isRetryable && attempt < MAX_UPLOAD_RETRIES) {
        const delayMs = attempt * 3000;
        console.log(`TTS Cache: Error reintentable, esperando ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }

  console.warn("TTS Cache: Falló la subida a Cloudinary. Retornando data URI local.", lastError);
  return dataUri;
}
