/**
 * @fileOverview Integración con Bible Brain (Faith Comes By Hearing / Digital Bible Platform v4 / Bible.is)
 * 
 * Proporciona acceso a audios bíblicos en español:
 * - Reina Valera 1960 Dramatizada (Múltiples actores, voces masculinas, femeninas y música)
 * - Reina Valera 1960 No Dramatizada
 * - Nueva Versión Internacional (NVI)
 * - Traducción en Lenguaje Actual (TLA)
 * - La Biblia de las Américas (LBLA)
 * - Dios Habla Hoy (DHH)
 * 
 * Documentación oficial: https://www.faithcomesbyhearing.com/bible-brain/developer-documentation
 * Base URL: https://4.dbt.io/api
 */

export interface BibleBrainVersion {
  id: string;
  bibleId: string;
  filesetId: string;
  name: string;
  type: 'drama' | 'non-drama';
  description: string;
  icon: string;
}

export const SPANISH_BIBLE_BRAIN_VERSIONS: BibleBrainVersion[] = [
  {
    id: 'rv60-drama',
    bibleId: 'SPNESP',
    filesetId: 'SPNBDA', // Reina Valera 1960 Dramatizada
    name: 'Reina Valera 1960 (Dramatizada)',
    type: 'drama',
    description: 'Elenco completo con voces de hombres, mujeres, música y efectos sonoros',
    icon: '🎭',
  },
  {
    id: 'nvi-drama',
    bibleId: 'SPNNVI',
    filesetId: 'SPNNVIDA', // NVI Dramatizada
    name: 'Nueva Versión Internacional (NVI)',
    type: 'drama',
    description: 'Narración dinámica en español contemporáneo dramatizado',
    icon: '🎙️',
  },
  {
    id: 'tla-drama',
    bibleId: 'SPNTLA',
    filesetId: 'SPNTLADA', // TLA Dramatizada
    name: 'Traducción en Lenguaje Actual (TLA)',
    type: 'drama',
    description: 'Lenguaje sencillo y cercano para lectura devocional y familiar',
    icon: '📖',
  },
  {
    id: 'dhh-drama',
    bibleId: 'SPNDHH',
    filesetId: 'SPNDHHDA', // Dios Habla Hoy
    name: 'Dios Habla Hoy (DHH)',
    type: 'drama',
    description: 'Traducción ecuménica y dinámica',
    icon: '✨',
  },
  {
    id: 'lbla-audio',
    bibleId: 'SPNLBL',
    filesetId: 'SPNLBLDA', // LBLA
    name: 'La Biblia de las Américas (LBLA)',
    type: 'non-drama',
    description: 'Locución solemne y fiel al texto original',
    icon: '📜',
  },
];

const BIBLE_BRAIN_BASE_URL = 'https://4.dbt.io/api';

/**
 * Obtiene la URL de audio firmada de Bible Brain para un libro y capítulo específico.
 * @param bookId Código de libro de 3 letras (ej. "GEN", "MAT", "PSA", "JHN")
 * @param chapterNumber Número de capítulo (ej. 1, 23, 28)
 * @param filesetId Identificador de fileset de Bible Brain (ej. "SPNBDA")
 */
export async function fetchBibleBrainAudioUrl(
  bookId: string,
  chapterNumber: number,
  filesetId = 'SPNBDA'
): Promise<{ audioUrl: string; duration?: number } | null> {
  const apiKey = process.env.BIBLE_BRAIN_API_KEY || process.env.FCBH_API_KEY;
  if (!apiKey) {
    console.warn('Bible Brain: Clave API no configurada (BIBLE_BRAIN_API_KEY).');
    return null;
  }

  const cleanBook = bookId.toUpperCase().trim();
  const url = `${BIBLE_BRAIN_BASE_URL}/bibles/filesets/${filesetId}/${cleanBook}/${chapterNumber}?v=4&key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // Cache 24h
    if (!res.ok) {
      console.warn(`Bible Brain API error HTTP ${res.status} para ${cleanBook} ${chapterNumber}`);
      return null;
    }

    const data = await res.json();
    const chapterData = data.data?.[0];

    if (chapterData && chapterData.path) {
      return {
        audioUrl: chapterData.path,
        duration: chapterData.duration,
      };
    }
  } catch (error) {
    console.error('Error fetching Bible Brain audio:', error);
  }

  return null;
}

/**
 * Obtiene las marcas de tiempo (timestamps) por versículo para sincronización karaoke.
 */
export async function fetchBibleBrainTimestamps(
  bookId: string,
  chapterNumber: number,
  filesetId = 'SPNBDA'
): Promise<{ verse: string; timestamp: number }[] | null> {
  const apiKey = process.env.BIBLE_BRAIN_API_KEY || process.env.FCBH_API_KEY;
  if (!apiKey) return null;

  const cleanBook = bookId.toUpperCase().trim();
  const url = `${BIBLE_BRAIN_BASE_URL}/bibles/filesets/${filesetId}/${cleanBook}/${chapterNumber}/verses?v=4&key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data || []).map((v: any) => ({
      verse: v.verse_start,
      timestamp: parseFloat(v.timestamp),
    }));
  } catch (error) {
    console.error('Error fetching Bible Brain timestamps:', error);
  }
  return null;
}
