import { NextRequest, NextResponse } from "next/server";
import { fetchBibleBrainAudioUrl, fetchBibleBrainTimestamps, SPANISH_BIBLE_BRAIN_VERSIONS } from "@/lib/bible-brain";

/**
 * GET /api/audio/bible-brain?book=GEN&chapter=1&version=rv60-drama
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const book = searchParams.get("book") || searchParams.get("bookId");
  const chapterStr = searchParams.get("chapter") || searchParams.get("chapterId");
  const versionId = searchParams.get("version") || "rv60-drama";
  const withTimestamps = searchParams.get("timestamps") === "true";

  if (!book || !chapterStr) {
    return NextResponse.json(
      { error: "Parámetros book y chapter requeridos", versions: SPANISH_BIBLE_BRAIN_VERSIONS },
      { status: 400 }
    );
  }

  const chapterNum = parseInt(chapterStr.split(".").pop() || "1", 10);
  const selectedVersion =
    SPANISH_BIBLE_BRAIN_VERSIONS.find((v) => v.id === versionId) ||
    SPANISH_BIBLE_BRAIN_VERSIONS[0];

  const audioFileset = selectedVersion.audioFilesetId || selectedVersion.textFilesetId;
  const audioResult = await fetchBibleBrainAudioUrl(book, chapterNum, audioFileset);

  if (!audioResult) {
    return NextResponse.json(
      {
        available: false,
        message: "Audio no disponible o clave de Bible Brain pendiente de activación.",
      },
      { status: 404 }
    );
  }

  let timestamps = null;
  if (withTimestamps) {
    timestamps = await fetchBibleBrainTimestamps(book, chapterNum, audioFileset);
  }


  return NextResponse.json({
    available: true,
    audioUrl: audioResult.audioUrl,
    duration: audioResult.duration,
    version: selectedVersion,
    timestamps,
  });
}
