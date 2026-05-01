import { adminDb } from "./firebase-admin";
import crypto from "crypto";
import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary usando variables de entorno
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

/**
 * Genera un hash único para un texto y una voz específica.
 */
function getCacheKey(text: string, voice: string): string {
    return crypto.createHash('md5').update(text + voice).digest('hex');
}

/**
 * Busca si ya existe un audio generado para este texto y voz.
 * Retorna la URL pública de Cloudinary o null si no existe.
 */
export async function getCachedAudio(text: string, voice: string): Promise<string | null> {
    if (!adminDb) {
        console.warn("Firebase Admin DB no está disponible. Cache desactivado.");
        return null;
    }
    try {
        const key = getCacheKey(text, voice);
        const snapshot = await adminDb.ref(`tts_cache/${key}`).get();
        if (snapshot.exists()) {
            const data = snapshot.val();
            // El valor guardado es la URL pública
            if (typeof data === 'string' && data.startsWith('https://')) {
                console.log(`TTS Cache: HIT para llave ${key}`);
                return data;
            }
            // Si es un data URI antiguo (formato anterior), ignorarlo para regenerar
            console.log(`TTS Cache: Dato antiguo encontrado para ${key}, se regenerará.`);
            return null;
        }
        return null;
    } catch (error) {
        console.error("Error al buscar en cache:", error);
        return null;
    }
}

/**
 * Sube el audio a Cloudinary (y lo convierte a MP3) y guarda la URL pública en Realtime Database.
 * 
 * @param text - El texto original usado para generar el audio
 * @param voice - El nombre de la voz utilizada
 * @param wavBase64 - El audio en formato WAV codificado en base64 (sin el prefijo data:)
 * @returns La URL pública del archivo en Cloudinary
 */
export async function cacheAudio(text: string, voice: string, wavBase64: string): Promise<string> {
    const dataUri = `data:audio/wav;base64,${wavBase64}`;

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn("Faltan credenciales de Cloudinary. Retornando data URI local temporal.");
        return dataUri;
    }

    try {
        const key = getCacheKey(text, voice);
        
        console.log(`TTS Cache: Iniciando subida y compresión a MP3 en Cloudinary...`);
        
        // Subir a Cloudinary como 'video' (audio usa la API de video) y convertir a MP3
        const uploadResponse = await cloudinary.uploader.upload(dataUri, {
            resource_type: "video",
            public_id: `bible_audio/${key}`,
            format: "mp3", // ¡Esta es la magia! Cloudinary convierte los 33MB de WAV a ~3MB de MP3
            overwrite: true
        });

        const publicUrl = uploadResponse.secure_url;

        // Guardar SOLO la URL en Realtime Database de Firebase
        if (adminDb) {
            await adminDb.ref(`tts_cache/${key}`).set(publicUrl);
        }

        console.log(`TTS Cache: Audio subido exitosamente → ${publicUrl}`);

        return publicUrl;
    } catch (error) {
        console.error("Error al subir a Cloudinary:", error);
        // Fallback: retornar data URI si falla la subida
        return dataUri;
    }
}
