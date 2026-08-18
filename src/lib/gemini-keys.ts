/**
 * @fileOverview Gestor de rotación de claves API de Gemini con balanceo de carga,
 * detección automática de errores de cuota (429/RESOURCE_EXHAUSTED) y cooldown inteligente.
 */

class GeminiKeyManager {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private cooldowns: Map<string, number> = new Map(); // apiKey -> timestamp ms

  constructor() {
    this.refreshKeys();
  }

  public refreshKeys(): string[] {
    const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    this.keys = envKeys
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    return this.keys;
  }

  public get totalKeys(): number {
    if (this.keys.length === 0) {
      this.refreshKeys();
    }
    return this.keys.length;
  }

  public getApiKeys(): string[] {
    if (this.keys.length === 0) {
      this.refreshKeys();
    }
    return [...this.keys];
  }

  public markKeyOnCooldown(key: string, seconds: number = 60): void {
    const keyMask = key.substring(0, 6) + '...' + key.substring(key.length - 4);
    const expireAt = Date.now() + seconds * 1000;
    this.cooldowns.set(key, expireAt);
    console.warn(`[GeminiKeyManager] ⚠️ Clave ${keyMask} pausada por cuota/429 durante ${seconds}s.`);
  }

  public isKeyOnCooldown(key: string): boolean {
    const expireAt = this.cooldowns.get(key);
    if (!expireAt) return false;
    if (Date.now() > expireAt) {
      this.cooldowns.delete(key);
      return false;
    }
    return true;
  }

  public getHealthyKeys(): string[] {
    if (this.keys.length === 0) {
      this.refreshKeys();
    }
    const healthy = this.keys.filter(k => !this.isKeyOnCooldown(k));
    if (healthy.length === 0) {
      // Si todas las claves cayeron en cooldown, liberar y permitir reintentos
      console.warn('[GeminiKeyManager] Todas las claves de Gemini estaban en cooldown. Reutilizando el pool completo...');
      return this.keys;
    }
    return healthy;
  }

  public getNextApiKey(): string {
    const healthy = this.getHealthyKeys();
    if (healthy.length === 0) {
      throw new Error('No hay claves API de Gemini configuradas en GEMINI_API_KEYS.');
    }
    this.currentIndex = (this.currentIndex + 1) % healthy.length;
    return healthy[this.currentIndex];
  }

  /**
   * Ejecuta una operación con reintento y rotación automática entre todas las claves disponibles.
   * Si una clave devuelve 429, 503 o agota su cuota, la pone en cooldown y prueba la siguiente inmediatamente.
   */
  public async executeWithRotation<T>(
    operation: (apiKey: string, keyIndex: number) => Promise<T>,
    options: { label?: string; maxAttempts?: number } = {}
  ): Promise<T> {
    if (this.keys.length === 0) {
      this.refreshKeys();
    }
    if (this.keys.length === 0) {
      throw new Error('No se encontraron claves en GEMINI_API_KEYS ni GEMINI_API_KEY.');
    }

    const { label = 'Gemini', maxAttempts = Math.max(this.keys.length, 3) } = options;
    let lastError: any = null;
    const triedKeys = new Set<string>();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Priorizar claves sanas que no hayan sido probadas aún en esta solicitud
      const available = this.getHealthyKeys().filter(k => !triedKeys.has(k));
      const key = available.length > 0 ? available[0] : this.getNextApiKey();
      const keyIndex = this.keys.indexOf(key);
      triedKeys.add(key);

      const keyMask = key.substring(0, 6) + '...' + key.substring(key.length - 4);

      try {
        const result = await operation(key, keyIndex);
        return result;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const isRetryable =
          msg.includes('429') ||
          msg.includes('503') ||
          msg.includes('500') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('UNAVAILABLE') ||
          msg.toLowerCase().includes('quota') ||
          msg.toLowerCase().includes('rate limit') ||
          msg.toLowerCase().includes('high demand');

        if (isRetryable && attempt < maxAttempts) {
          let cooldownSeconds = 60;
          const retryMatch = msg.match(/retry in ([\d.]+)s/i);
          if (retryMatch && parseFloat(retryMatch[1])) {
            cooldownSeconds = Math.ceil(parseFloat(retryMatch[1])) + 2;
          }
          this.markKeyOnCooldown(key, cooldownSeconds);
          console.warn(`[${label}] Intento ${attempt}/${maxAttempts} con clave ${keyMask} falló por cuota/saturación. Rotando a la siguiente clave sana...`);
          await new Promise(r => setTimeout(r, 300));
        } else {
          // Si no es un error de cuota/servidor o se agotaron los intentos, lanzar
          throw err;
        }
      }
    }

    throw new Error(`[${label}] Todas las claves API de Gemini agotaron sus intentos (${this.keys.length} claves probadas). Último error: ${lastError?.message || lastError}`);
  }
}

// Instancia singleton para compartir el estado de cooldowns y punteros entre peticiones
export const geminiKeyManager = new GeminiKeyManager();

export async function executeWithGeminiKeyRotation<T>(
  operation: (apiKey: string, keyIndex: number) => Promise<T>,
  options?: { label?: string; maxAttempts?: number }
): Promise<T> {
  return geminiKeyManager.executeWithRotation(operation, options);
}

export function getNextGeminiApiKey(): string {
  return geminiKeyManager.getNextApiKey();
}

export function getGeminiApiKeys(): string[] {
  return geminiKeyManager.getApiKeys();
}

export function markGeminiKeyCooldown(key: string, seconds?: number): void {
  geminiKeyManager.markKeyOnCooldown(key, seconds);
}
