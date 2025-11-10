"use server";

import type { SearchResult } from '@/lib/types';

const API_BASE_URL = 'https://api.scripture.api.bible/v1';

export async function searchVerses(
  query: string,
  versionId: string,
  apiKey: string | null
): Promise<SearchResult | { error: string }> {
  console.log(`Searching for "${query}" in version ${versionId}`);

  if (!apiKey) {
    return { error: 'Clave API no configurada. Por favor, ve a la página de configuración.' };
  }
  
  if (!query) {
    return { verses: [], total: 0, bibleId: versionId };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/bibles/${versionId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
      headers: {
        'api-key': apiKey,
      },
      cache: 'no-store' 
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        if (response.status === 401) {
             return { error: 'Clave API no válida o sin permisos.' };
        }
        return { error: `Error de la API: ${errorData.message || response.statusText}` };
    }

    const data = await response.json();

    if (data.data.total === 0) {
      return { verses: [], total: 0, bibleId: versionId };
    }

    const verses = data.data.verses.map((verse: any) => ({
      id: verse.id,
      reference: verse.reference,
      text: verse.text.replace(/<[^>]*>/g, '').trim(), // Strip HTML tags from verse text
    }));

    return {
      verses,
      total: data.data.total,
      bibleId: versionId,
    };

  } catch (error: any) {
    console.error("Network or parsing error:", error);
    return { error: `Ha ocurrido un error de red: ${error.message}` };
  }
}
