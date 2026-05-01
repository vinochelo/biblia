import { ref, get, set } from "firebase/database";
import { ref as sRef, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase-config";
import crypto from "crypto";

/**
 * Genera un hash único para un texto y una voz específica.
 */
function getCacheKey(text: string, voice: string): string {
    return crypto.createHash('md5').update(text + voice).digest('hex');
}

/**
 * Busca si ya existe un audio generado para este texto y voz en el cache de Firebase.
 * Retorna la URL de descarga o null si no existe.
 */
export async function getCachedAudio(text: string, voice: string): Promise<string | null> {
    try {
        const key = getCacheKey(text, voice);
        const dbRef = ref(db, `tts_cache/${key}`);
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
            console.log(`TTS Cache: Hit para llave ${key}`);
            return snapshot.val();
        }
        return null;
    } catch (error) {
        console.error("Error al buscar en cache:", error);
        return null;
    }
}

/**
 * Guarda un audio generado en Firebase Storage y su referencia en la Database.
 */
export async function cacheAudio(text: string, voice: string, base64Wav: string): Promise<string> {
    try {
        const key = getCacheKey(text, voice);
        const storageRef = sRef(storage, `tts/${key}.wav`);
        
        console.log(`TTS Cache: Guardando audio en storage para llave ${key}...`);
        
        // Subir a Firebase Storage
        await uploadString(storageRef, base64Wav, 'base64', {
            contentType: 'audio/wav',
        });
        
        const downloadUrl = await getDownloadURL(storageRef);
        
        // Guardar la URL en la Realtime Database para búsquedas rápidas
        const dbRef = ref(db, `tts_cache/${key}`);
        await set(dbRef, downloadUrl);
        
        console.log(`TTS Cache: Guardado exitosamente. URL: ${downloadUrl}`);
        return downloadUrl;
    } catch (error) {
        console.error("Error al guardar en cache:", error);
        throw error;
    }
}
