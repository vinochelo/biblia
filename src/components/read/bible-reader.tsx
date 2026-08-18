"use client";

import { getBooks, getChapters, getChapter } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Book, ChapterSummary, Chapter } from "@/lib/types";
import {
  Loader2,
  Terminal,
  BookOpen,
  Play,
  Pause,
  Volume2,
  AlertCircle,
  Mic,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookText,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { defineTerm } from "@/ai/flows/dictionary-flow";
import { findConcordance, type ConcordanceOutput } from "@/ai/flows/concordance-flow";
import { trackApiCall, trackAiApiCall, extractPlainTextFromBibleHtml } from "@/lib/utils";
import { getHumanAudioForChapter } from "@/lib/human-audio-map";
import { NATURAL_VOICES, DEFAULT_AI_VOICE } from "@/lib/tts-voices";
import { FontSizeControl, type FontSize, FONT_CONFIG } from "@/components/common/font-size-control";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const BIBLE_VERSION_STORAGE_KEY = "bible-version-id";
const LAST_BOOK_STORAGE_KEY = "last-book-id";
const LAST_CHAPTER_STORAGE_KEY = "last-chapter-id";
const FONT_SIZE_STORAGE_KEY = "preferred_bible_font_size";

type AudioStatus = "idle" | "loading" | "playing" | "paused" | "error";

function BibleReaderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [version, setVersion] = useState<string>(() => {
    if (typeof window === "undefined") return bibleVersions[0].id;
    return localStorage.getItem(BIBLE_VERSION_STORAGE_KEY) || bibleVersions[0].id;
  });

  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterContent, setChapterContent] = useState<Chapter | null>(null);

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "md";
    return (localStorage.getItem(FONT_SIZE_STORAGE_KEY) as FontSize) || "md";
  });

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    if (typeof window !== "undefined") {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    }
  };

  const [isLoading, setIsLoading] = useState({
    books: true,
    chapters: false,
    content: false,
    dictionary: false,
    concordance: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Dictionary state
  const [selection, setSelection] = useState<string>("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<{
    term: string;
    definition: string;
    reference?: string;
  } | null>(null);
  const [concordanceResult, setConcordanceResult] = useState<ConcordanceOutput | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // TTS / Audio state
  const [selectedNarrator] = useState<string>("samuel-montoya");
  const [selectedAiVoice, setSelectedAiVoice] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_AI_VOICE;
    return localStorage.getItem("preferred_ai_voice") || DEFAULT_AI_VOICE;
  });
  const [audioSourceMode, setAudioSourceMode] = useState<"human" | "ai">("human");
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0); // 0–100
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCache = useRef<Record<string, string>>({});

  const handleAiVoiceChange = (voiceId: string) => {
    setSelectedAiVoice(voiceId);
    if (typeof window !== "undefined") {
      localStorage.setItem("preferred_ai_voice", voiceId);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioStatus("idle");
    setAudioUrl(null);
    setAudioProgress(0);
  };

  const handleVersionChange = (newVersion: string) => {
    setVersion(newVersion);
    localStorage.setItem(BIBLE_VERSION_STORAGE_KEY, newVersion);
    setSelectedBook(null);
    setChapters([]);
    setSelectedChapter(null);
    setChapterContent(null);
    router.push(`/read`);
  };

  const handleBookChange = (bookId: string) => {
    setSelectedBook(bookId);
    localStorage.setItem(LAST_BOOK_STORAGE_KEY, bookId);
    setSelectedChapter(null);
    setChapterContent(null);
    localStorage.removeItem(LAST_CHAPTER_STORAGE_KEY);
    router.push(`/read?book=${bookId}`);
  };

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapter(chapterId);
    localStorage.setItem(LAST_CHAPTER_STORAGE_KEY, chapterId);
    router.push(`/read?chapter=${chapterId}`);
  };

  const fetchBooks = useCallback(async (versionId: string) => {
    setIsLoading((p) => ({ ...p, books: true }));
    setError(null);
    trackApiCall();
    const booksResponse = await getBooks(versionId);
    if ("error" in booksResponse) {
      setError(booksResponse.error);
    } else {
      setBooks(booksResponse);
      const chapterIdFromUrl = searchParams.get("chapter");
      const bookIdFromUrl = chapterIdFromUrl?.split(".")[0] || searchParams.get("book");
      const lastBook = localStorage.getItem(LAST_BOOK_STORAGE_KEY);
      const bookToSelect = bookIdFromUrl || lastBook;
      if (bookToSelect && booksResponse.some((b) => b.id === bookToSelect)) {
        setSelectedBook(bookToSelect);
      } else {
        setSelectedBook(null);
      }
    }
    setIsLoading((p) => ({ ...p, books: false }));
  }, [searchParams]);

  const fetchChapters = useCallback(async (versionId: string, bookId: string) => {
    setIsLoading((p) => ({ ...p, chapters: true }));
    setError(null);
    trackApiCall();
    const response = await getChapters(versionId, bookId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapters(response);
      const chapterIdFromUrl = searchParams.get("chapter");
      const lastChapter = localStorage.getItem(LAST_CHAPTER_STORAGE_KEY);
      const chapterToSelect = chapterIdFromUrl || (lastChapter && lastChapter.startsWith(bookId) ? lastChapter : null);
      if (chapterToSelect && response.some((c) => c.id === chapterToSelect)) {
        setSelectedChapter(chapterToSelect);
      } else {
        setSelectedChapter(null);
      }
    }
    setIsLoading((p) => ({ ...p, chapters: false }));
  }, [searchParams]);

  const fetchChapterContent = useCallback(async (versionId: string, chapterId: string) => {
    setIsLoading((p) => ({ ...p, content: true }));
    setError(null);
    setChapterContent(null);
    trackApiCall();
    const response = await getChapter(versionId, chapterId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapterContent(response);
    }
    setIsLoading((p) => ({ ...p, content: false }));
  }, []);

  // Main data fetching logic
  useEffect(() => {
    fetchBooks(version);
  }, [version, fetchBooks]);

  useEffect(() => {
    if (selectedBook) {
      fetchChapters(version, selectedBook);
    } else {
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [selectedBook, version, fetchChapters]);

  useEffect(() => {
    if (selectedChapter) {
      fetchChapterContent(version, selectedChapter);
    } else {
      setChapterContent(null);
    }
  }, [selectedChapter, version, fetchChapterContent]);

  // Reset & prepare audio state when chapter changes or source mode changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    setAudioStatus("idle");
    setAudioError(null);
    setAudioProgress(0);

    if (selectedChapter) {
      if (audioSourceMode === "human") {
        const humanAudio = getHumanAudioForChapter(selectedChapter, selectedNarrator);
        if (humanAudio) {
          setAudioUrl(humanAudio);
          return;
        }
      }
    }
    setAudioUrl(null);
  }, [selectedChapter, audioSourceMode, selectedNarrator]);

  // ── Audio Playback Logic ───────────────────────────────────────────────────

  const handlePlayAudio = async () => {
    if (audioRef.current && audioStatus === "playing") {
      audioRef.current.pause();
      setAudioStatus("paused");
      return;
    }

    if (audioRef.current && audioUrl && audioStatus === "paused") {
      try {
        await audioRef.current.play();
        setAudioStatus("playing");
      } catch (e) {
        console.error("Error resuming audio:", e);
      }
      return;
    }

    // Case 1: Human Pre-recorded Audio
    if (audioSourceMode === "human" && selectedChapter) {
      const humanUrl = getHumanAudioForChapter(selectedChapter, selectedNarrator);
      if (humanUrl) {
        setAudioUrl(humanUrl);
        if (audioRef.current) {
          audioRef.current.src = humanUrl;
          try {
            await audioRef.current.play();
            setAudioStatus("playing");
          } catch (e) {
            console.error("Error playing human audio:", e);
          }
        }
        return;
      }
    }

    // Case 2: AI Voice
    if (!chapterContent) return;

    const plainText = extractPlainTextFromBibleHtml(chapterContent.content);
    if (!plainText) {
      setAudioError("No se encontró texto para leer.");
      setAudioStatus("error");
      return;
    }

    const cacheKey = `${selectedChapter || ""}_ai_${selectedAiVoice}`;
    if (audioCache.current[cacheKey]) {
      const cachedUrl = audioCache.current[cacheKey];
      setAudioUrl(cachedUrl);
      if (audioRef.current) {
        audioRef.current.src = cachedUrl;
        await audioRef.current.play();
        setAudioStatus("playing");
      }
      return;
    }

    setAudioStatus("loading");
    setAudioError(null);

    try {
      const res = await fetch("/api/tts?action=check-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: plainText,
          chapterId: selectedChapter,
          forceAi: true,
          generateIfMissing: true,
          voice: selectedAiVoice,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(err.error || `Error ${res.status} al generar audio`);
      }

      const data = await res.json();

      if (data.status === "cached" && data.audio) {
        const url = data.audio;
        audioCache.current[cacheKey] = url;
        setAudioUrl(url);
        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play();
        }
        setAudioStatus("playing");
        return;
      }

      if (data.status === "in_progress") {
        for (let p = 0; p < 15; p++) {
          await new Promise((r) => setTimeout(r, 2000));
          const pollRes = await fetch("/api/tts?action=check-cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: plainText,
              generateIfMissing: false,
              forceAi: true,
              voice: selectedAiVoice,
            }),
          });
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.status === "cached" && pollData.audio) {
              const url = pollData.audio;
              audioCache.current[cacheKey] = url;
              setAudioUrl(url);
              if (audioRef.current) {
                audioRef.current.src = url;
                await audioRef.current.play();
              }
              setAudioStatus("playing");
              return;
            }
          }
        }
      }

      throw new Error("El audio tardó demasiado en generarse. Inténtalo de nuevo.");
    } catch (e: any) {
      console.error("TTS error:", e);
      setAudioError(e.message || "Error desconocido al generar audio.");
      setAudioStatus("error");
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const { currentTime, duration } = audioRef.current;
    if (duration > 0) {
      setAudioProgress((currentTime / duration) * 100);
    }
  };

  const handleAudioEnded = () => {
    setAudioStatus("paused");
    setAudioProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleAudioError = () => {
    if (
      !audioRef.current?.src ||
      audioRef.current.src === "" ||
      audioRef.current.src === window.location.href ||
      audioStatus === "idle"
    ) {
      return;
    }
    setAudioError("Error al reproducir el audio. Intenta generarlo de nuevo.");
    setAudioStatus("error");
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = ratio * audioRef.current.duration;
  };

  // ── Dictionary handlers ──────────────────────────────────────────────────

  const handleSelection = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    const anchorNode = sel?.anchorNode;
    if (text.length > 2 && text.length < 50 && anchorNode && contentRef.current?.contains(anchorNode)) {
      setSelection(text);
      const range = sel?.getRangeAt(0);
      if (range) {
        setSelectionRect(range.getBoundingClientRect());
      }
    } else {
      setSelection("");
      setSelectionRect(null);
    }
  };

  const handleDefine = async () => {
    if (!selection) return;
    setIsLoading((p) => ({ ...p, dictionary: true, concordance: true }));
    setDictionaryResult(null);
    setConcordanceResult(null);
    setIsDictionaryOpen(true);
    setSelectionRect(null);

    trackAiApiCall("dictionary");

    try {
      const sel = window.getSelection();
      const range = sel?.getRangeAt(0);
      let context = "";
      if (range) {
        const parentElement = range.startContainer.parentElement;
        context = parentElement?.textContent || "";
      }

      const [definitionResult, concordanceData] = await Promise.all([
        defineTerm({ term: selection, context }),
        findConcordance({ term: selection, context }),
      ]);

      setDictionaryResult(definitionResult);
      setConcordanceResult(concordanceData);
      setIsLoading((p) => ({ ...p, dictionary: false, concordance: false }));
    } catch (e) {
      console.error(e);
      setDictionaryResult({
        term: selection,
        definition: "No se pudo obtener la definición. Inténtalo de nuevo.",
      });
      setConcordanceResult({ verses: [] });
      setIsLoading((p) => ({ ...p, dictionary: false, concordance: false }));
    }
  };

  // Chapter navigation helpers
  const currentChapterIndex = chapters.findIndex((c) => c.id === selectedChapter);
  const prevChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : null;

  const currentVersionObj = bibleVersions.find((v) => v.id === version) || bibleVersions[0];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        style={{ display: "none" }}
      />

      {/* ── Selector Bar (Versión y Libro) ── */}
      <Card className="border border-border/60 shadow-xs rounded-2xl bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BookText className="h-3.5 w-3.5 text-primary" />
                Versión de la Biblia
              </label>
              <Select value={version} onValueChange={handleVersionChange}>
                <SelectTrigger className="w-full bg-background rounded-xl h-10">
                  <SelectValue placeholder="Seleccionar versión" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {bibleVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs py-2">
                      <span className="font-bold text-primary mr-1.5">{v.abbreviation}</span>
                      <span>({v.name})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                Libro
              </label>
              <Select
                value={selectedBook ?? ""}
                onValueChange={handleBookChange}
                disabled={isLoading.books || books.length === 0}
              >
                <SelectTrigger className="w-full bg-background rounded-xl h-10">
                  <SelectValue placeholder={isLoading.books ? "Cargando libros..." : "Seleccionar libro"} />
                </SelectTrigger>
                <SelectContent className="max-h-72 rounded-xl">
                  {books.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs py-2">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Selector de Capítulos ── */}
      {selectedBook && (
        isLoading.chapters ? (
          <div className="flex justify-center items-center h-24">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : chapters.length > 0 ? (
          <Card className="border border-border/50 rounded-2xl bg-muted/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Capítulos disponibles ({chapters.length})
                </h3>
                {selectedChapter && (
                  <span className="text-xs text-primary font-medium">
                    Capítulo activo: <strong>{selectedChapter.split(".").pop()}</strong>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                {chapters.map((c) => {
                  const isSelected = selectedChapter === c.id;
                  return (
                    <Button
                      key={c.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleChapterChange(c.id)}
                      className={`h-9 w-9 text-xs font-semibold rounded-xl transition-all duration-150 ${
                        isSelected
                          ? "shadow-sm scale-105 font-bold"
                          : "bg-background hover:bg-background/80 hover:scale-105"
                      }`}
                    >
                      {c.number}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null
      )}

      {/* ── Contenido de Lectura ── */}
      <div className="min-h-[400px]">
        {error && (
          <Alert variant="destructive" className="rounded-2xl">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading.content && (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando capítulo...</p>
          </div>
        )}

        {!isLoading.content && chapterContent && (
          <Card
            onMouseUp={handleSelection}
            onTouchEnd={handleSelection}
            ref={contentRef}
            className="shadow-sm border border-border/70 rounded-3xl overflow-hidden bg-card"
          >
            {/* Header del Lector */}
            <CardHeader className="bg-muted/30 border-b border-border/50 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Título y Navegación rápida de capítulo */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="font-headline text-2xl md:text-3xl font-bold tracking-tight">
                      {chapterContent.reference}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-bold">
                      {currentVersionObj.abbreviation}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentVersionObj.name}
                  </p>
                </div>

                {/* Controles de Tamaño de Letra y Navegación Anterior / Siguiente */}
                <div className="flex flex-wrap items-center gap-2">
                  <FontSizeControl fontSize={fontSize} onChange={handleFontSizeChange} />

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!prevChapter}
                      onClick={() => prevChapter && handleChapterChange(prevChapter.id)}
                      className="h-8 px-2.5 rounded-xl text-xs"
                      title={prevChapter ? `Ir a capítulo anterior (${prevChapter.number})` : "Primer capítulo"}
                    >
                      <ChevronLeft className="h-4 w-4 mr-0.5" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!nextChapter}
                      onClick={() => nextChapter && handleChapterChange(nextChapter.id)}
                      className="h-8 px-2.5 rounded-xl text-xs"
                      title={nextChapter ? `Ir a capítulo siguiente (${nextChapter.number})` : "Último capítulo"}
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="h-4 w-4 ml-0.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Audio Toolbar ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2">
                  {/* Selector de Modo de Audio */}
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl text-xs font-medium border border-border/40">
                    <button
                      type="button"
                      onClick={() => setAudioSourceMode("human")}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                        audioSourceMode === "human"
                          ? "bg-background text-foreground shadow-xs font-bold text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Locución oficial de Samuel Montoya (RVR 1909)"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Humana</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAudioSourceMode("ai")}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                        audioSourceMode === "ai"
                          ? "bg-background text-foreground shadow-xs font-bold text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Voz con inteligencia artificial"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>IA Neuronal</span>
                    </button>
                  </div>

                  {audioSourceMode === "human" && (
                    <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                      🎙️ <strong>Samuel Montoya</strong>
                    </span>
                  )}

                  {audioSourceMode === "ai" && (
                    <Select value={selectedAiVoice} onValueChange={handleAiVoiceChange}>
                      <SelectTrigger className="h-8 text-xs w-[180px] bg-background rounded-xl">
                        <SelectValue placeholder="Voz IA" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {NATURAL_VOICES.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-xs">
                            {v.icon} {v.name} ({v.country})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Botón de Reproducción y Barra de Progreso */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handlePlayAudio}
                    disabled={audioStatus === "loading"}
                    className="h-8 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    {audioStatus === "loading" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generando...
                      </>
                    ) : audioStatus === "playing" ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Pausar
                      </>
                    ) : audioStatus === "paused" ? (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Continuar
                      </>
                    ) : audioStatus === "error" ? (
                      <>
                        <AlertCircle className="h-3.5 w-3.5" />
                        Reintentar
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" />
                        Escuchar {audioSourceMode === "human" ? "Locución" : "con IA"}
                      </>
                    )}
                  </Button>

                  {audioUrl && (audioStatus === "playing" || audioStatus === "paused") && (
                    <div
                      className="w-28 sm:w-36 h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
                      onClick={handleSeek}
                      title="Haz clic para avanzar o retroceder"
                    >
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-200"
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {audioStatus === "error" && audioError && (
                <p className="text-xs text-destructive text-right">{audioError}</p>
              )}
            </CardHeader>

            {/* Texto Bíblico con tamaño dinámico */}
            <CardContent className="p-6 md:p-10">
              <div
                className={`bible-reader-text reader-text-${fontSize} prose max-w-none text-justify font-body select-text`}
                style={{
                  '--bible-font-size': FONT_CONFIG[fontSize].fontSize,
                  '--bible-line-height': FONT_CONFIG[fontSize].lineHeight,
                } as React.CSSProperties}
                dangerouslySetInnerHTML={{ __html: chapterContent.content }}
              />


              {/* Botones al pie del capítulo */}
              <div className="flex items-center justify-between pt-10 mt-10 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!prevChapter}
                  onClick={() => prevChapter && handleChapterChange(prevChapter.id)}
                  className="rounded-xl text-xs"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Capítulo Anterior
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nextChapter}
                  onClick={() => nextChapter && handleChapterChange(nextChapter.id)}
                  className="rounded-xl text-xs"
                >
                  Capítulo Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectionRect && (
          <div
            style={{
              position: "fixed",
              top: `${selectionRect.top - 40}px`,
              left: `${selectionRect.left + selectionRect.width / 2 - 20}px`,
            }}
          >
            <Button onClick={handleDefine} size="icon" className="rounded-full shadow-lg h-9 w-9">
              <BookOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Dialogo de Diccionario */}
        <Dialog open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
          <DialogContent className="sm:max-w-md md:max-w-2xl max-h-[90vh] flex flex-col p-0 rounded-2xl overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/20">
              <DialogTitle className="font-headline text-2xl font-bold">Diccionario y Concordancia</DialogTitle>
              <DialogDescription>
                Definición y versículos relacionados para <span className="font-bold text-foreground">{dictionaryResult?.term}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-base font-headline font-bold mb-2 text-primary">Definición Teológica</h3>
                {isLoading.dictionary ? (
                  <div className="flex justify-center items-center h-20">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2 text-sm leading-relaxed">
                    <p>{dictionaryResult?.definition}</p>
                    {dictionaryResult?.reference && (
                      <blockquote className="mt-3 border-l-2 border-primary/50 pl-3 italic text-muted-foreground">
                        {dictionaryResult.reference}
                      </blockquote>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-base font-headline font-bold mb-2 text-primary">Concordancia Bíblica</h3>
                {isLoading.concordance ? (
                  <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : concordanceResult && concordanceResult.verses.length > 0 ? (
                  <div className="space-y-3">
                    {concordanceResult.verses.map((verse, index) => (
                      <div key={index} className="p-3 bg-muted/30 rounded-xl border border-border/40 text-xs space-y-1">
                        <h4 className="font-bold font-headline text-primary">{verse.reference}</h4>
                        <p className="text-muted-foreground">{verse.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-xs">No se encontraron concordancias.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {!isLoading.content && !chapterContent && !error && selectedBook && selectedChapter && (
          <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/10">
            <p className="text-muted-foreground text-sm">El contenido del capítulo aparecerá aquí.</p>
          </div>
        )}

        {!selectedBook && !error && !isLoading.books && (
          <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/10 space-y-2">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-muted-foreground text-sm font-medium">Selecciona un libro para ver los capítulos disponibles.</p>
          </div>
        )}

        {selectedBook && !selectedChapter && !isLoading.chapters && !isLoading.content && !error && (
          <div className="text-center py-12 border border-dashed rounded-2xl bg-muted/10 space-y-2">
            <BookText className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-muted-foreground text-sm font-medium">Selecciona un número de capítulo para comenzar tu lectura.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function BibleReader() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <BibleReaderContent />
    </Suspense>
  );
}
