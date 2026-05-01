import { ref, get, set } from "firebase/database";
import { db } from "./firebase-config";
import crypto from "crypto";

/**
 * Genera un hash único para un texto y una voz específica.
 */
function getCacheKey(text: string, voice: string): string {
    return crypto.createHash('md5').update(text + voice).digest('hex');
}

/**
 * Busca si ya existe un audio generado para este texto y voz en la Realtime Database.
 * Retorna el string base64 o null si no existe.
 */
export async function getCachedAudio(text: string, voice: string): Promise<string | null> {
    if (!db) return null;
    try {
        const key = getCacheKey(text, voice);
        const dbRef = ref(db, `tts_cache/${key}`);
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
            console.log(`TTS Cache (DB): Hit para llave ${key}`);
            return snapshot.val();
        }
        return null;
    } catch (error) {
        console.error("Error al buscar en cache (DB):", error);
        return null;
    }
}

/**
 * Guarda un audio generado (en formato base64 completo) en la Realtime Database.
 */
export async function cacheAudio(text: string, voice: string, base64Wav: string): Promise<string> {
    const dataUri = `data:audio/wav;base64,${base64Wav}`;
    if (!db) return dataUri;
    try {
        const key = getCacheKey(text, voice);
        const dbRef = ref(db, `tts_cache/${key}`);
        
        console.log(`TTS Cache (DB): Guardando audio en base de datos para llave ${key}...`);
        
        await set(dbRef, dataUri);
        
        console.log(`TTS Cache (DB): Guardado exitosamente.`);
        return dataUri;
    } catch (error) {
        console.error("Error al guardar en cache (DB):", error);
        return dataUri;
    }
}
