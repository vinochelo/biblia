import { NextRequest, NextResponse } from "next/server";
import { fetchBibleBrainChapterText, SPANISH_BIBLE_BRAIN_VERSIONS } from "@/lib/bible-brain";

const API_BASE_URL = "https://rest.api.bible";
const apiKey = process.env.BIBLE_API_KEY;

const bookToId: { [key: string]: string } = {
  Génesis: "GEN", Éxodo: "EXO", Levítico: "LEV", Números: "NUM", Deuteronomio: "DEU",
  Josué: "JOS", Jueces: "JDG", Rut: "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
  "1 Reyes": "1KI", "2 Reyes": "2KI", "1 Crónicas": "1CH", "2 Crónicas": "2CH", Esdras: "EZR",
  Nehemías: "NEH", Ester: "EST", Job: "JOB", Salmos: "PSA", Proverbios: "PRO",
  Eclesiastés: "ECC", Cantares: "SNG", Isaías: "ISA", Jeremías: "JER",
  Lamentaciones: "LAM", Ezequiel: "EZK", Daniel: "DAN", Oseas: "HOS", Joel: "JOL",
  Amós: "AMO", Abdías: "OBA", Jonás: "JON", Miqueas: "MIC", Nahum: "NAM",
  Habacuc: "HAB", Sofonías: "ZEP", Hageo: "HAG", Zacarías: "ZEC", Malaquías: "MAL",
  Mateo: "MAT", Marcos: "MRK", Lucas: "LUK", Juan: "JHN", Hechos: "ACT",
  Romanos: "ROM", "1 Corintios": "1CO", "2 Corintios": "2CO", Gálatas: "GAL", Efesios: "EPH",
  Filipenses: "PHP", Colosenses: "COL", "1 Tesalonicenses": "1TH", "2 Tesalonicenses": "2TH",
  "1 Timoteo": "1TI", "2 Timoteo": "2TI", Tito: "TIT", Filemón: "PHM", Hebreos: "HEB",
  Santiago: "JAS", "1 Pedro": "1PE", "2 Pedro": "2PE", "1 Juan": "1JN", "2 Juan": "2JN",
  "3 Juan": "3JN", Judas: "JUD", Apocalipsis: "REV",
};

function formatVerseNumbers(html: string): string {
  return html.replace(
    /(<span[^>]*class="v"[^>]*>\d{1,3}<\/span>)(\S)/g,
    "$1 $2"
  );
}

function parsePassageString(passage: string): { passageRef: string; chapterIds: string[] } {
  const bookNames = Object.keys(bookToId).sort((a, b) => b.length - a.length);
  const normalizedPassage = passage.replace(/\s+/g, "");
  for (const bookName of bookNames) {
    const normalizedBookName = bookName.replace(/\s+/g, "");
    if (normalizedPassage.startsWith(normalizedBookName)) {
      const bookId = bookToId[bookName];
      const remaining = normalizedPassage.substring(normalizedBookName.length);
      const chapters = remaining.split(",").map((s) => s.trim()).filter(Boolean);
      return { passageRef: passage, chapterIds: chapters.map((ch) => `${bookId}.${ch}`) };
    }
  }
  return { passageRef: passage, chapterIds: [] };
}

async function fetchChapter(versionId: string, chapterId: string): Promise<{ reference: string; content: string } | { error: string }> {
  // 1. Si la versión pertenece a Bible Brain (FCBH / Bible.is)
  if (versionId.startsWith("bb-")) {
    const bbVersion = SPANISH_BIBLE_BRAIN_VERSIONS.find((v) => v.id === versionId) || SPANISH_BIBLE_BRAIN_VERSIONS[0];
    const [book, chStr] = chapterId.split(".");
    const chNum = parseInt(chStr, 10) || 1;
    const bbResult = await fetchBibleBrainChapterText(book, chNum, bbVersion.textFilesetId);

    if ("error" in bbResult) {
      // Si la clave de Bible Brain aún no está configurada, hacer respaldo automático a RVR 1909
      console.log(`Bible Brain no disponible para ${versionId}, usando respaldo de RVR 1909...`);
      return fetchChapter("592420522e16049f-01", chapterId);
    }
    return bbResult;
  }

  // 2. Si la versión pertenece a API.Bible
  if (!apiKey) return { error: "API key not configured" };

  const params = new URLSearchParams({
    "content-type": "html",
    "include-notes": "false",
    "include-titles": "true",
    "include-chapter-numbers": "false",
    "include-verse-numbers": "true",
    "include-verse-spans": "false",
  });

  const url = `${API_BASE_URL}/v1/bibles/${versionId}/chapters/${chapterId}?${params}`;

  const response = await fetch(url, {
    headers: { "api-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    return { error: errorData?.message || `HTTP ${response.status}` };
  }

  const data = await response.json();
  const chapter = data.data;

  return {
    reference: chapter.reference || chapterId,
    content: typeof chapter.content === "string" ? formatVerseNumbers(chapter.content) : "",
  };
}


/**
 * GET /api/passages?passages=Juan+4,1Samuel+14,1Samuel+15,Proverbios+26&version=xxx
 * 
 * This API route fetches a SINGLE chapter at a time from the client.
 * The client calls it once per chapter ID, so each request is fast (< 3s).
 * 
 * Query params:
 *   - chapterId: e.g. "JHN.4"
 *   - version: Bible version ID
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chapterId = searchParams.get("chapterId");
  const version = searchParams.get("version") || searchParams.get("versionId") || "592420522e16049f-01";

  if (!chapterId) {
    return NextResponse.json({ error: "Falta parámetro: chapterId es requerido." }, { status: 400 });
  }

  try {
    const result = await fetchChapter(version, chapterId);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      reference: result.reference,
      content: result.content,
    });
  } catch (e: any) {
    console.error(`API passages error for ${chapterId}:`, e);
    return NextResponse.json({ error: e.message || "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * POST /api/passages
 * Body: { passages: ["Juan 4", "1Samuel 14, 15", "Proverbios 26"], version: "xxx" }
 * 
 * Resolves all passage strings into chapter IDs and returns them.
 * The client then fetches each chapter individually via GET.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passages } = body;
    const version = body.version || body.versionId || "592420522e16049f-01";

    if (!passages || !Array.isArray(passages)) {
      return NextResponse.json({ error: "Falta parámetro: passages array es requerido." }, { status: 400 });
    }


    const allChapterIds: { passageRef: string; chapterId: string }[] = [];

    for (const passage of passages) {
      const { passageRef, chapterIds } = parsePassageString(passage);
      for (const chapterId of chapterIds) {
        allChapterIds.push({ passageRef, chapterId });
      }
    }

    return NextResponse.json({ chapters: allChapterIds });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error parseando pasajes" }, { status: 500 });
  }
}
