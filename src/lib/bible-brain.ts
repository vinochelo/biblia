/**
 * @fileOverview Integración con Bible Brain (Faith Comes By Hearing / Digital Bible Platform v4 / Bible.is)
 * 
 * Proporciona acceso a textos y audios bíblicos en español:
 * - Reina Valera 1960 (RVR1960) [Texto + Audio Dramatizado]
 * - Nueva Versión Internacional (NVI) [Texto + Audio Dramatizado]
 * - Traducción en Lenguaje Actual (TLA) [Texto + Audio Dramatizado]
 * - Dios Habla Hoy (DHH) [Texto + Audio Dramatizado]
 * - La Biblia de las Américas (LBLA) [Texto + Audio Solemne]
 * - Reina Valera 1909 (RVR09) [Texto + Audio Clásico]
 * 
 * Documentación oficial: https://www.faithcomesbyhearing.com/bible-brain/developer-documentation
 * Base URL: https://4.dbt.io/api
 */

export interface BibleBrainVersion {
  id: string;
  bibleId: string;
  textFilesetId: string;
  audioFilesetId?: string;
  name: string;
  abbreviation: string;
  type: 'drama' | 'non-drama' | 'text-only';
  description: string;
  icon: string;
}

export const SPANISH_BIBLE_BRAIN_VERSIONS: BibleBrainVersion[] = [
  {
    id: 'bb-rv60',
    bibleId: 'SPNESP',
    textFilesetId: 'SPNESP',
    audioFilesetId: 'SPNBDA',
    name: 'Reina Valera 1960',
    abbreviation: 'RVR60',
    type: 'drama',
    description: 'La versión más leída en el mundo hispano, con elenco dramatizado completo',
    icon: '🎭',
  },
  {
    id: 'bb-nvi',
    bibleId: 'SPNNVI',
    textFilesetId: 'SPNNVI',
    audioFilesetId: 'SPNNVIDA',
    name: 'Nueva Versión Internacional',
    abbreviation: 'NVI',
    type: 'drama',
    description: 'Español contemporáneo, claro y con audio dramatizado de alta calidad',
    icon: '🎙️',
  },
  {
    id: 'bb-tla',
    bibleId: 'SPNTLA',
    textFilesetId: 'SPNTLA',
    audioFilesetId: 'SPNTLADA',
    name: 'Traducción en Lenguaje Actual',
    abbreviation: 'TLA',
    type: 'drama',
    description: 'Traducción directa, sencilla y accesible para toda la familia',
    icon: '📖',
  },
  {
    id: 'bb-dhh',
    bibleId: 'SPNDHH',
    textFilesetId: 'SPNDHH',
    audioFilesetId: 'SPNDHHDA',
    name: 'Dios Habla Hoy',
    abbreviation: 'DHH',
    type: 'drama',
    description: 'Versión popular y dinámica con dramatización',
    icon: '✨',
  },
  {
    id: 'bb-lbla',
    bibleId: 'SPNLBL',
    textFilesetId: 'SPNLBL',
    audioFilesetId: 'SPNLBLDA',
    name: 'La Biblia de las Américas',
    abbreviation: 'LBLA',
    type: 'non-drama',
    description: 'Traducción de alta fidelidad literal y solemne',
    icon: '📜',
  },
];

const BIBLE_BRAIN_BASE_URL = 'https://4.dbt.io/api';

/**
 * Obtiene el texto formateado de un capítulo desde Bible Brain.
 * @param bookId Código de libro de 3 letras (ej. "GEN", "MAT", "PSA", "JHN")
 * @param chapterNumber Número de capítulo (ej. 1, 23, 28)
 * @param textFilesetId Identificador de fileset de texto (ej. "SPNESP", "SPNNVI")
 */
export async function fetchBibleBrainChapterText(
  bookId: string,
  chapterNumber: number,
  textFilesetId = 'SPNESP'
): Promise<{ reference: string; content: string } | { error: string }> {
  const apiKey = process.env.BIBLE_BRAIN_API_KEY || process.env.FCBH_API_KEY;
  if (!apiKey) {
    return {
      error: 'La clave de Bible Brain aún no está configurada (BIBLE_BRAIN_API_KEY).',
    };
  }

  const cleanBook = bookId.toUpperCase().trim();
  const url = `${BIBLE_BRAIN_BASE_URL}/bibles/filesets/${textFilesetId}/${cleanBook}/${chapterNumber}?v=4&key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } }); // Cache 24h
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        error: errData?.error?.message || `Bible Brain error HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const verses: Array<{
      verse_start: number | string;
      verse_text: string;
    }> = data.data || [];

    if (!verses || verses.length === 0) {
      return { error: `No se encontraron versículos en Bible Brain para ${cleanBook} ${chapterNumber}.` };
    }

    // Formatear a HTML con spans de versículos consistentes con api.bible
    const formattedHtml = verses
      .map((v) => `<p><span class="v">${v.verse_start}</span> ${v.verse_text.trim()}</p>`)
      .join('\n');

    return {
      reference: `${cleanBook} ${chapterNumber}`,
      content: formattedHtml,
    };
  } catch (error: any) {
    console.error('Error fetching Bible Brain chapter text:', error);
    return { error: error?.message || 'Error de conexión con Bible Brain' };
  }
}

/**
 * Obtiene la URL de audio firmada de Bible Brain para un libro y capítulo específico.
 */
export async function fetchBibleBrainAudioUrl(
  bookId: string,
  chapterNumber: number,
  audioFilesetId = 'SPNBDA'
): Promise<{ audioUrl: string; duration?: number } | null> {
  const apiKey = process.env.BIBLE_BRAIN_API_KEY || process.env.FCBH_API_KEY;
  if (!apiKey) {
    console.warn('Bible Brain: Clave API no configurada (BIBLE_BRAIN_API_KEY).');
    return null;
  }

  const cleanBook = bookId.toUpperCase().trim();
  const url = `${BIBLE_BRAIN_BASE_URL}/bibles/filesets/${audioFilesetId}/${cleanBook}/${chapterNumber}?v=4&key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.warn(`Bible Brain Audio API error HTTP ${res.status} para ${cleanBook} ${chapterNumber}`);
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
  audioFilesetId = 'SPNBDA'
): Promise<{ verse: string; timestamp: number }[] | null> {
  const apiKey = process.env.BIBLE_BRAIN_API_KEY || process.env.FCBH_API_KEY;
  if (!apiKey) return null;

  const cleanBook = bookId.toUpperCase().trim();
  const url = `${BIBLE_BRAIN_BASE_URL}/bibles/filesets/${audioFilesetId}/${cleanBook}/${chapterNumber}/verses?v=4&key=${apiKey}`;

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
