"use server";

import type { SearchResult } from '@/lib/types';

const API_BASE_URL = 'https://rest.api.bible';

export async function searchVerses(
  query: string,
  versionId: string,
  apiKey: string
): Promise<SearchResult | { error: string }> {
  if (!apiKey) {
    return { error: 'Clave API no configurada. Por favor, ve a la página de configuración.' };
  }
  
  if (!query) {
    return { verses: [], total: 0, bibleId: versionId };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/bibles/${versionId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
      headers: {
        'api-key': apiKey,
      },
      cache: 'no-store' 
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `Error: ${response.status} ${response.statusText}`;
        console.error("API Error:", response.status, errorMessage);
        
        if (response.status === 401 || (typeof errorMessage === 'string' && errorMessage.includes('API key'))) {
             return { error: 'Clave API no válida o sin permisos. Verifica tu clave e inténtalo de nuevo.' };
        }

        return { error: `Error de la API: ${errorMessage}` };
    }

    const data = await response.json();

    if (!data.data) {
      // This handles cases where the API returns a 200 OK but the data object is missing.
      return { verses: [], total: 0, bibleId: versionId };
    }
    
    // The API might return an empty 'verses' array or null.
    const versesData = data.data.verses || [];

    const verses = versesData.map((verse: any) => ({
      id: verse.id,
      reference: verse.reference,
      text: verse.text, 
    }));

    return {
      verses,
      total: data.data.total || 0,
      bibleId: versionId,
    };

  } catch (error: any) {
    console.error("Error de red o de análisis:", error);
    // This catches network errors (e.g., DNS, connection refused) or JSON parsing errors.
    return { error: `Ha ocurrido un error de red o de comunicación: ${error.message}` };
  }
}
