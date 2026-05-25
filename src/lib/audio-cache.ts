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

export function getCacheKey(text: string, voice: string): string {
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
  const wavBuffer = Buffer.from(wavBase64, 'base64');
  const sizeMB = (wavBuffer.length / (1024 * 1024)).toFixed(1);
  console.log(`TTS Cache: Tamaño del audio WAV: ${sizeMB} MB`);

  if (!ensureCloudinaryConfig()) {
    if (wavBuffer.length > 3 * 1024 * 1024) {
      console.error("TTS Cache: Audio demasiado grande para data URI sin Cloudinary. Abortando.");
      throw new Error("Audio generado es demasiado grande para servir sin Cloudinary. Configure las credenciales de Cloudinary.");
    }
    console.warn("TTS Cache: Retornando data URI local (sin Cloudinary).");
    return `data:audio/wav;base64,${wavBase64}`;
  }

  const key = getCacheKey(text, voice);
  const MAX_UPLOAD_RETRIES = 3;
  const UPLOAD_TIMEOUT_MS = 120000;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      console.log(`TTS Cache: Subiendo y comprimiendo a MP3 en Cloudinary... (intento ${attempt}/${MAX_UPLOAD_RETRIES}, timeout: ${UPLOAD_TIMEOUT_MS / 1000}s)`);

      const uploadPromise = cloudinary.uploader.upload(
        `data:audio/wav;base64,${wavBase64}`,
        {
          resource_type: "video",
          public_id: `bible_audio/${key}`,
          format: "mp3",
          overwrite: true,
          timeout: UPLOAD_TIMEOUT_MS,
        }
      );

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Upload timeout after ${UPLOAD_TIMEOUT_MS / 1000}s`)), UPLOAD_TIMEOUT_MS + 5000)
      );

      const uploadResponse = await Promise.race([uploadPromise, timeoutPromise]);

      const publicUrl = uploadResponse.secure_url;

      if (adminDb) {
        try {
          await adminDb.ref(`tts_cache/${key}`).set(publicUrl);
        } catch (dbError) {
          console.error("TTS Cache: Error guardando URL en Firebase RTDB (audio ya subido a Cloudinary):", dbError);
        }
      }

      const mp3SizeKB = uploadResponse.bytes ? (uploadResponse.bytes / 1024).toFixed(1) : '?';
      console.log(`TTS Cache: Audio subido exitosamente → ${publicUrl} (MP3: ${mp3SizeKB} KB, compresión: ${sizeMB} MB → ~${Math.round(parseInt(mp3SizeKB || '0') / 1024)} MB)`);
      return publicUrl;
    } catch (error: unknown) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isRetryable = errorMsg.includes('ECONNRESET') ||
        errorMsg.includes('ETIMEDOUT') ||
        errorMsg.includes('ECONNREFUSED') ||
        errorMsg.includes('network') ||
        errorMsg.includes('429') ||
        errorMsg.includes('rate') ||
        errorMsg.includes('Timeout') ||
        errorMsg.includes('timeout');

      console.error(`TTS Cache: Error al subir a Cloudinary (intento ${attempt}/${MAX_UPLOAD_RETRIES}):`, errorMsg);

      if (isRetryable && attempt < MAX_UPLOAD_RETRIES) {
        const delayMs = attempt * 5000;
        console.log(`TTS Cache: Error reintentable, esperando ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }

  if (wavBuffer.length > 3 * 1024 * 1024) {
    console.error("TTS Cache: Audio demasiado grande para data URI fallback. Abortando.");
    throw new Error(`No se pudo subir el audio a Cloudinary (${sizeMB} MB). Reintente en unos minutos.`);
  }

  console.warn("TTS Cache: Falló la subida a Cloudinary. Retornando data URI local.");
  return `data:audio/wav;base64,${wavBase64}`;
}
