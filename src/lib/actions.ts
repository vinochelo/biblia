
"use server";

import type { SearchResult, Book, ChapterSummary, Chapter, Verse } from '@/lib/types';

const API_BASE_URL = 'https://rest.api.bible';

// La clave API ahora se lee de forma segura desde las variables de entorno del servidor.
const apiKey = process.env.BIBLE_API_KEY;

const bookToId: { [key: string]: string } = {
    "Génesis": "GEN", "Éxodo": "EXO", "Levítico": "LEV", "Números": "NUM", "Deuteronomio": "DEU",
    "Josué": "JOS", "Jueces": "JDG", "Rut": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
    "1 Reyes": "1KI", "2 Reyes": "2KI", "1 Crónicas": "1CH", "2 Crónicas": "2CH", "Esdras": "EZR",
    "Nehemías": "NEH", "Ester": "EST", "Job": "JOB", "Salmos": "PSA", "Proverbios": "PRO",
    "Eclesiastés": "ECC", "Cantares": "SNG", "Isaías": "ISA", "Jeremías": "JER",
    "Lamentaciones": "LAM", "Ezequiel": "EZK", "Daniel": "DAN", "Oseas": "HOS", "Joel": "JOL",
    "Amós": "AMO", "Abdías": "OBA", "Jonás": "JON", "Miqueas": "MIC", "Nahum": "NAM",
    "Habacuc": "HAB", "Sofonías": "ZEP", "Hageo": "HAG", "Zacarías": "ZEC", "Malaquías": "MAL",
    "Mateo": "MAT", "Marcos": "MRK", "Lucas": "LUK", "Juan": "JHN", "Hechos": "ACT",
    "Romanos": "ROM", "1 Corintios": "1CO", "2 Corintios": "2CO", "Gálatas": "GAL", "Efesios": "EPH",
    "Filipenses": "PHP", "Colosenses": "COL", "1 Tesalonicenses": "1TH", "2 Tesalonicenses": "2TH",
    "1 Timoteo": "1TI", "2 Timoteo": "2TI", "Tito": "TIT", "Filemón": "PHM", "Hebreos": "HEB",
    "Santiago": "JAS", "1 Pedro": "1PE", "2 Pedro": "2PE", "1 Juan": "1JN", "2 Juan": "2JN",
    "3 Juan": "3JN", "Judas": "JUD", "Apocalipsis": "REV"
};


async function apiCall<T>(path: string, params?: Record<string, string>): Promise<T | { error: string }> {
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
      let errorMessage = errorData?.message || `Error: ${response.status} ${response.statusText}`;
      console.error("API Error:", response.status, errorMessage);

      if (response.status === 401 || (typeof errorMessage === 'string' && (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('authorized')))) {
           errorMessage = 'La clave API del servidor no es válida o no tiene permisos para acceder a este recurso. Verifique la clave y los permisos en su cuenta de rest.api.bible.';
      } else if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('not found')) {
          errorMessage = `No se encontró el recurso solicitado. Es posible que el libro, capítulo o versículo no exista en esta versión de la Biblia.`;
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
    const result = await apiCall<Chapter>(`/v1/bibles/${versionId}/chapters/${chapterId}`, params);
     if ('error' in result) {
        return result;
    }
    // The API sometimes wraps the content in a weird object, this unwraps it.
    if (typeof result === 'object' && result !== null && 'content' in result && typeof (result as any).content === 'string') {
        return result;
    }
    return result;
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

function parsePassageString(passage: string): { passageRef: string, chapterIds: string[] } {
    const bookNames = Object.keys(bookToId).sort((a, b) => b.length - a.length);
    for (const bookName of bookNames) {
        if (passage.startsWith(bookName)) {
            const bookId = bookToId[bookName];
            const remaining = passage.substring(bookName.length).trim();
            const chapters = remaining.split(',').map(s => s.trim()).filter(Boolean);
            return {
                passageRef: passage,
                chapterIds: chapters.map(ch => `${bookId}.${ch}`)
            };
        }
    }
    return { passageRef: passage, chapterIds: [] };
}

export async function getPassagesText(passages: string[], versionId: string): Promise<string | { error: string }> {
    let combinedContent = "";
    for (const p of passages) {
        const { chapterIds } = parsePassageString(p);
        if (chapterIds.length === 0) continue;

        for (const chapterId of chapterIds) {
            const result = await getChapter(versionId, chapterId);
            if ('error' in result) {
                return { error: `No se pudo cargar el texto para ${chapterId}: ${result.error}` };
            }
            if (result && result.content) {
                combinedContent += result.content;
            }
        }
    }

    if (!combinedContent) {
        return { error: "No se encontró el contenido para los pasajes seleccionados." };
    }
    return combinedContent;
}
