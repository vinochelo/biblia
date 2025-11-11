"use server";

import type { SearchResult, Book, ChapterSummary, Chapter, Verse } from '@/lib/types';

const API_BASE_URL = 'https://rest.api.bible';

// La clave API ahora se lee de forma segura desde las variables de entorno del servidor.
const apiKey = process.env.BIBLE_API_KEY;

const trackApiCall = () => {
  // This is a server action, it cannot directly modify client-side localStorage.
  // The client will be responsible for tracking its own API calls.
  // We can, however, log this server-side if needed.
};

async function apiCall<T>(path: string, params?: Record<string, string>): Promise<T | { error: string }> {
  trackApiCall();
  if (!apiKey) {
    return { error: 'La clave API del servidor no está configurada. El administrador del sitio debe configurarla.' };
  }

  try {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    const response = await fetch(url.toString(), {
      headers: { 'api-key': apiKey },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || `Error: ${response.status} ${response.statusText}`;
      console.error("API Error:", response.status, errorMessage);
      if (response.status === 401 || (typeof errorMessage === 'string' && errorMessage.includes('API key'))) {
           return { error: 'La clave API del servidor no es válida o no tiene permisos.' };
      }
      return { error: `Error de la API: ${errorMessage}` };
    }
    
    const data = await response.json();
    return data.data;

  } catch (error: any) {
    console.error("Error de red o de análisis:", error);
    return { error: `Ha ocurrido un error de red o de comunicación: ${error.message}` };
  }
}

export async function searchVerses(
  query: string,
  versionId: string,
): Promise<SearchResult | { error: string }> {
  if (!query) {
    return { verses: [], total: 0, bibleId: versionId };
  }

  const result = await apiCall<any>(`/v1/bibles/${versionId}/search?query=${encodeURIComponent(query)}&sort=relevance`);

  if ('error' in result) {
    return result;
  }
  
  if (!result) {
    return { verses: [], total: 0, bibleId: versionId };
  }

  const versesData = result.verses || [];
  const verses = versesData.map((verse: any) => ({
    id: verse.id,
    reference: verse.reference,
    text: verse.text, 
  }));

  return {
    verses,
    total: result.total || 0,
    bibleId: versionId,
  };
}


export async function getBooks(versionId: string): Promise<Book[] | { error: string }> {
    return apiCall<Book[]>(`/v1/bibles/${versionId}/books`);
}

export async function getChapters(versionId: string, bookId: string): Promise<ChapterSummary[] | { error: string }> {
    return apiCall<ChapterSummary[]>(`/v1/bibles/${versionId}/books/${bookId}/chapters`);
}

export async function getChapter(versionId: string, chapterId: string): Promise<Chapter | { error: string }> {
    const params = {
        'content-type': 'html',
        'include-notes': 'false',
        'include-titles': 'true',
        'include-chapter-numbers': 'false',
        'include-verse-numbers': 'true',
        'include-verse-spans': 'false'
    };
    return apiCall<Chapter>(`/v1/bibles/${versionId}/chapters/${chapterId}`, params);
}

export async function getVerse(versionId: string, verseId: string): Promise<Verse | { error: string }> {
  const params = {
    'content-type': 'text',
    'include-notes': 'false',
    'include-titles': 'false',
    'include-chapter-numbers': 'false',
    'include-verse-numbers': 'false',
    'include-verse-spans': 'false',
  };
  const result = await apiCall<{id: string; reference: string; content: string}>(`/v1/bibles/${versionId}/verses/${verseId}`, params);
  if ('error' in result) {
    return result;
  }
  return {
    id: result.id,
    reference: result.reference,
    text: result.content,
  };
}
