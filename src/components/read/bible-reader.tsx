"use client";

import { getBooks, getChapters, getChapter } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Book, ChapterSummary, Chapter } from "@/lib/types";
import { Loader2, Terminal, BookOpen, Play, Pause, Volume2, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { defineTerm } from "@/ai/flows/dictionary-flow";
import { findConcordance, type ConcordanceOutput } from "@/ai/flows/concordance-flow";
import { trackApiCall, trackAiApiCall, extractPlainTextFromBibleHtml } from "@/lib/utils";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

const BIBLE_VERSION_STORAGE_KEY = "bible-version-id";
const LAST_BOOK_STORAGE_KEY = "last-book-id";
const LAST_CHAPTER_STORAGE_KEY = "last-chapter-id";

type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';



/**
 * Ensambla un Blob URL de WAV directamente en el navegador a partir de fragmentos PCM en base64.
 * Esto permite reproducir el audio inmediatamente sin depender de Cloudinary.
 */
function buildWavBlobUrl(pcmPartsBase64: string[]): string {
  const TTS_SAMPLE_RATE = 24000;
  const TTS_CHANNELS = 1;
  const TTS_BIT_DEPTH = 16;

  // Decodificar todos los fragmentos base64 a Uint8Array
  const buffers = pcmPartsBase64.map((b64) => {
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return bytes;
  });

  const totalPcmLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const pcmData = new Uint8Array(totalPcmLength);
  let offset = 0;
  for (const buf of buffers) { pcmData.set(buf, offset); offset += buf.length; }

  // Construir header WAV
  const wavHeader = new ArrayBuffer(44);
  const v = new DataView(wavHeader);
  // RIFF
  v.setUint8(0, 0x52); v.setUint8(1, 0x49); v.setUint8(2, 0x46); v.setUint8(3, 0x46); // "RIFF"
  v.setUint32(4, 36 + pcmData.length, true);
  v.setUint8(8, 0x57); v.setUint8(9, 0x41); v.setUint8(10, 0x56); v.setUint8(11, 0x45); // "WAVE"
  // fmt
  v.setUint8(12, 0x66); v.setUint8(13, 0x6d); v.setUint8(14, 0x74); v.setUint8(15, 0x20); // "fmt "
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, TTS_CHANNELS, true);
  v.setUint32(24, TTS_SAMPLE_RATE, true);
  v.setUint32(28, TTS_SAMPLE_RATE * TTS_CHANNELS * (TTS_BIT_DEPTH / 8), true);
  v.setUint16(32, TTS_CHANNELS * (TTS_BIT_DEPTH / 8), true);
  v.setUint16(34, TTS_BIT_DEPTH, true);
  // data
  v.setUint8(36, 0x64); v.setUint8(37, 0x61); v.setUint8(38, 0x74); v.setUint8(39, 0x61); // "data"
  v.setUint32(40, pcmData.length, true);

  const wavBuffer = new Uint8Array(44 + pcmData.length);
  wavBuffer.set(new Uint8Array(wavHeader), 0);
  wavBuffer.set(pcmData, 44);

  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function BibleReaderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [version, setVersion] = useState<string>(() => {
    if (typeof window === 'undefined') return bibleVersions[0].id;
    return localStorage.getItem(BIBLE_VERSION_STORAGE_KEY) || bibleVersions[0].id;
  });

  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterContent, setChapterContent] = useState<Chapter | null>(null);
  
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
  const [dictionaryResult, setDictionaryResult] = useState<{term: string, definition: string, reference?: string} | null>(null);
  const [concordanceResult, setConcordanceResult] = useState<ConcordanceOutput | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // TTS / Audio state
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0); // 0–100
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [hasPendingCloudSave, setHasPendingCloudSave] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Cache audio URL per chapter so we don't re-request
  const audioCache = useRef<Record<string, string>>({});
  // Store pending PCM parts & text for retry if cloud save fails
  const pendingPcmParts = useRef<string[]>([]);
  const pendingText = useRef<string>('');
  // Track blob URLs to revoke on chapter change
  const blobUrlRef = useRef<string | null>(null);


  const handleVersionChange = (newVersion: string) => {
    setVersion(newVersion);
    localStorage.setItem(BIBLE_VERSION_STORAGE_KEY, newVersion);
    // Reset selections when version changes
    setSelectedBook(null);
    setChapters([]);
    setSelectedChapter(null);
    setChapterContent(null);
    router.push(`/read`);
  };

  const handleBookChange = (bookId: string) => {
    setSelectedBook(bookId);
    localStorage.setItem(LAST_BOOK_STORAGE_KEY, bookId);
    // Reset chapter when book changes
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
    setIsLoading(p => ({ ...p, books: true }));
    setError(null);
    trackApiCall();
    const booksResponse = await getBooks(versionId);
    if ("error" in booksResponse) {
      setError(booksResponse.error);
    } else {
      setBooks(booksResponse);
      // Determine which book to select
      const chapterIdFromUrl = searchParams.get('chapter');
      const bookIdFromUrl = chapterIdFromUrl?.split('.')[0] || searchParams.get('book');
      const lastBook = localStorage.getItem(LAST_BOOK_STORAGE_KEY);
      const bookToSelect = bookIdFromUrl || lastBook;
      if (bookToSelect && booksResponse.some(b => b.id === bookToSelect)) {
        setSelectedBook(bookToSelect);
      } else {
        // If no valid book is found, we don't select one
        setSelectedBook(null);
      }
    }
    setIsLoading(p => ({ ...p, books: false }));
  }, [searchParams]);

  const fetchChapters = useCallback(async (versionId: string, bookId: string) => {
    setIsLoading(p => ({ ...p, chapters: true }));
    setError(null);
    trackApiCall();
    const response = await getChapters(versionId, bookId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapters(response);
      // Determine which chapter to select
      const chapterIdFromUrl = searchParams.get('chapter');
      const lastChapter = localStorage.getItem(LAST_CHAPTER_STORAGE_KEY);
      const chapterToSelect = chapterIdFromUrl || (lastChapter && lastChapter.startsWith(bookId) ? lastChapter : null);
      if (chapterToSelect && response.some(c => c.id === chapterToSelect)) {
        setSelectedChapter(chapterToSelect);
      } else {
        setSelectedChapter(null);
      }
    }
    setIsLoading(p => ({ ...p, chapters: false }));
  }, [searchParams]);
  
  const fetchChapterContent = useCallback(async (versionId: string, chapterId: string) => {
    setIsLoading(p => ({ ...p, content: true }));
    setError(null);
    setChapterContent(null);
    trackApiCall();
    const response = await getChapter(versionId, chapterId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapterContent(response);
    }
    setIsLoading(p => ({ ...p, content: false }));
  }, []);

  // Main data fetching logic
  useEffect(() => {
    fetchBooks(version);
  }, [version, fetchBooks]);

  useEffect(() => {
    if (selectedBook) {
      fetchChapters(version, selectedBook);
    } else {
      // Clear dependent state if no book is selected
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [selectedBook, version, fetchChapters]);

  useEffect(() => {
    if (selectedChapter) {
      fetchChapterContent(version, selectedChapter);
    } else {
      // Clear content if no chapter is selected
      setChapterContent(null);
    }
  }, [selectedChapter, version, fetchChapterContent]);

  // Reset audio state when chapter changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    // Revoke old blob URL to free memory
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setAudioStatus('idle');
    setAudioUrl(null);
    setAudioError(null);
    setAudioProgress(0);
    setChunkProgress(null);
    setIsSavingToCloud(false);
    setHasPendingCloudSave(false);
    pendingPcmParts.current = [];
    pendingText.current = '';
  }, [selectedChapter]);

  // ── TTS Logic ──────────────────────────────────────────────────────────────

  const handlePlayAudio = async () => {
    // If already have a URL loaded and paused, just resume
    if (audioRef.current && audioUrl && audioStatus === 'paused') {
      audioRef.current.play();
      setAudioStatus('playing');
      return;
    }

    // If playing, pause
    if (audioRef.current && audioStatus === 'playing') {
      audioRef.current.pause();
      setAudioStatus('paused');
      return;
    }

    // If we already cached the URL for this chapter, play directly
    if (selectedChapter && audioCache.current[selectedChapter]) {
      const cachedUrl = audioCache.current[selectedChapter];
      setAudioUrl(cachedUrl);
      setAudioStatus('playing');
      if (audioRef.current) {
        audioRef.current.src = cachedUrl;
        audioRef.current.play();
      }
      return;
    }

    if (!chapterContent) return;

    const plainText = extractPlainTextFromBibleHtml(chapterContent.content);
    if (!plainText) {
      setAudioError('No se encontró texto para leer.');
      setAudioStatus('error');
      return;
    }

    setAudioStatus('loading');
    setAudioError(null);
    setChunkProgress(null);

    try {
      // Step 1: Check cache / trigger generation
      const cacheRes = await fetch('/api/tts?action=check-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText, generateIfMissing: true }),
      });

      if (!cacheRes.ok) {
        const err = await cacheRes.json().catch(() => ({ error: `Error ${cacheRes.status}` }));
        throw new Error(err.error || `Error ${cacheRes.status} al verificar caché`);
      }

      const cacheData = await cacheRes.json();

      if (cacheData.status === 'cached' && cacheData.audio) {
        // Audio already cached — play directly
        const url = cacheData.audio;
        if (selectedChapter) audioCache.current[selectedChapter] = url;
        setAudioUrl(url);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
        }
        setAudioStatus('playing');
        return;
      }

      // If another process is already generating, poll until ready
      if (cacheData.status === 'in_progress') {
        for (let p = 0; p < 15; p++) {
          await new Promise(r => setTimeout(r, 3000));
          const pollRes = await fetch('/api/tts?action=check-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: plainText, generateIfMissing: false }),
          });
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.status === 'cached' && pollData.audio) {
              const url = pollData.audio;
              if (selectedChapter) audioCache.current[selectedChapter] = url;
              setAudioUrl(url);
              if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play();
              }
              setAudioStatus('playing');
              return;
            }
          }
        }
      }


      // Step 2: Generate chunks
      const chunks: string[] = cacheData.chunks || [];
      if (chunks.length === 0) throw new Error('No se recibieron fragmentos de texto para procesar.');

      setChunkProgress({ current: 0, total: chunks.length });

      const pcmParts: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setChunkProgress({ current: i + 1, total: chunks.length });

        let attempts = 0;
        const maxAttempts = 3;
        let pcmBase64: string | null = null;

        while (attempts < maxAttempts && pcmBase64 === null) {
          attempts++;
          const chunkRes = await fetch('/api/tts?action=generate-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunkText: chunks[i], chunkIndex: i, totalChunks: chunks.length }),
          });

          if (chunkRes.status === 429 && attempts < maxAttempts) {
            // Rate limited — wait and retry
            await new Promise(r => setTimeout(r, 5000 * attempts));
            continue;
          }

          if (!chunkRes.ok) {
            const err = await chunkRes.json().catch(() => ({ error: `Error ${chunkRes.status}` }));
            throw new Error(err.error || `Error generando fragmento ${i + 1}`);
          }

          const chunkData = await chunkRes.json();
          if (!chunkData.pcmBase64) throw new Error(`Fragmento ${i + 1} no retornó datos de audio.`);
          pcmBase64 = chunkData.pcmBase64;
        }

        if (!pcmBase64) throw new Error(`No se pudo generar el fragmento ${i + 1} después de ${maxAttempts} intentos.`);
        pcmParts.push(pcmBase64);
      }

      // Step 3: Reproducir inmediatamente desde el navegador (Blob URL local)
      // Esto garantiza que el usuario escuche el audio aunque Cloudinary falle.
      setChunkProgress(null);
      const blobUrl = buildWavBlobUrl(pcmParts);
      blobUrlRef.current = blobUrl;
      setAudioUrl(blobUrl);
      if (audioRef.current) {
        audioRef.current.src = blobUrl;
        audioRef.current.play();
      }
      setAudioStatus('playing');

      // Guardar PCM parts y texto para posibles reintentos de guardado
      pendingPcmParts.current = pcmParts;
      pendingText.current = plainText;

      // Step 4 (segundo plano): Subir a Cloudinary para caché permanente
      setIsSavingToCloud(true);
      (async () => {
        const MAX_FINALIZE_ATTEMPTS = 3;
        for (let attempt = 1; attempt <= MAX_FINALIZE_ATTEMPTS; attempt++) {
          try {
            const finalRes = await fetch('/api/tts?action=finalize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: plainText, pcmParts }),
            });
            if (!finalRes.ok) {
              const err = await finalRes.json().catch(() => ({ error: `Error ${finalRes.status}` }));
              throw new Error(err.error || `Error finalizando (intento ${attempt})`);
            }
            const finalData = await finalRes.json();
            if (finalData.audio) {
              // Reemplazar blob URL con URL permanente de Cloudinary
              if (selectedChapter) audioCache.current[selectedChapter] = finalData.audio;
              // Actualizar src del audio solo si sigue reproduciendo el mismo audio
              if (audioRef.current && blobUrlRef.current === blobUrl) {
                const currentTime = audioRef.current.currentTime;
                const wasPlaying = !audioRef.current.paused;
                audioRef.current.src = finalData.audio;
                audioRef.current.currentTime = currentTime;
                if (wasPlaying) audioRef.current.play();
                blobUrlRef.current = null;
                URL.revokeObjectURL(blobUrl);
              }
              setAudioUrl(finalData.audio);
              pendingPcmParts.current = [];
              pendingText.current = '';
              setHasPendingCloudSave(false);
            }
            break;
          } catch (e: any) {
            console.warn(`TTS finalize intento ${attempt}/${MAX_FINALIZE_ATTEMPTS} falló:`, e.message);
            if (attempt < MAX_FINALIZE_ATTEMPTS) {
              await new Promise(r => setTimeout(r, attempt * 5000));
            } else {
              console.error('TTS: No se pudo guardar en la nube. El audio se mantiene reproducible en esta sesión.');
            }
          }
        }
        setIsSavingToCloud(false);
        // If we exhausted all attempts and still have pending parts, show retry button
        if (pendingPcmParts.current.length > 0) {
          setHasPendingCloudSave(true);
        }
      })();

    } catch (e: any) {
      console.error('TTS error:', e);
      setAudioError(e.message || 'Error desconocido al generar el audio.');
      setAudioStatus('error');
      setChunkProgress(null);
      setIsSavingToCloud(false);
    }
  };

  /** Reintentar guardar en la nube los PCM que ya están en memoria */
  const handleRetryCloudSave = async () => {
    if (pendingPcmParts.current.length === 0 || !pendingText.current) return;
    setIsSavingToCloud(true);
    try {
      const finalRes = await fetch('/api/tts?action=finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pendingText.current, pcmParts: pendingPcmParts.current }),
      });
      if (!finalRes.ok) {
        const err = await finalRes.json().catch(() => ({ error: `Error ${finalRes.status}` }));
        throw new Error(err.error || 'Error al reintentar guardar');
      }
      const finalData = await finalRes.json();
      if (finalData.audio) {
        if (selectedChapter) audioCache.current[selectedChapter] = finalData.audio;
        if (audioRef.current && blobUrlRef.current) {
          const currentTime = audioRef.current.currentTime;
          const wasPlaying = !audioRef.current.paused;
          audioRef.current.src = finalData.audio;
          audioRef.current.currentTime = currentTime;
          if (wasPlaying) audioRef.current.play();
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        setAudioUrl(finalData.audio);
        pendingPcmParts.current = [];
        pendingText.current = '';
        setHasPendingCloudSave(false);
      }
    } catch (e: any) {
      console.error('TTS retry cloud save error:', e);
    } finally {
      setIsSavingToCloud(false);
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
    setAudioStatus('paused');
    setAudioProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleAudioError = () => {
    setAudioError('Error al reproducir el audio. Intenta generarlo de nuevo.');
    setAudioStatus('error');
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
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    const anchorNode = selection?.anchorNode;
    if (text.length > 2 && text.length < 50 && anchorNode && contentRef.current?.contains(anchorNode)) {
      setSelection(text);
      const range = selection?.getRangeAt(0);
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
    setIsLoading(p => ({ ...p, dictionary: true, concordance: true }));
    setDictionaryResult(null);
    setConcordanceResult(null);
    setIsDictionaryOpen(true);
    setSelectionRect(null);

    trackAiApiCall('dictionary');

    try {
        const sel = window.getSelection();
        const range = sel?.getRangeAt(0);
        let context = '';
        if (range) {
            const parentElement = range.startContainer.parentElement;
            context = parentElement?.textContent || '';
        }

        // Fetch definition and concordance in parallel
        const [definitionResult, concordanceData] = await Promise.all([
          defineTerm({ term: selection, context }),
          findConcordance({ term: selection, context })
        ]);

        setDictionaryResult(definitionResult);
        setIsLoading(p => ({ ...p, dictionary: false }));

        setConcordanceResult(concordanceData);
        setIsLoading(p => ({ ...p, concordance: false }));

    } catch (e) {
        console.error(e);
        setDictionaryResult({term: selection, definition: "No se pudo obtener la definición. Inténtalo de nuevo."});
        setConcordanceResult({verses: []});
        setIsLoading(p => ({ ...p, dictionary: false, concordance: false }));
    }
  };


  return (
    <div className="space-y-6">
        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
          style={{ display: 'none' }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select value={version} onValueChange={handleVersionChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar versión" />
                </SelectTrigger>
                <SelectContent>
                    {bibleVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                        {v.abbreviation} ({v.name})
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={selectedBook ?? ""} onValueChange={handleBookChange} disabled={isLoading.books || books.length === 0}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoading.books ? "Cargando..." : "Seleccionar libro"} />
                </SelectTrigger>
                <SelectContent>
                    {books.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                        {b.name}
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {selectedBook && (isLoading.chapters ? (
             <div className="flex justify-center items-center h-full pt-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
        ) : chapters.length > 0 ? (
            <div className="space-y-4 pt-4">
                <h3 className="text-xl font-headline font-bold text-center">Selecciona un Capítulo</h3>
                <div className="flex flex-wrap justify-center gap-2">
                    {chapters.map((c) => (
                        <Button
                            key={c.id}
                            variant={selectedChapter === c.id ? "default" : "outline"}
                            onClick={() => handleChapterChange(c.id)}
                            className="w-12 h-12 text-lg"
                        >
                            {c.number}
                        </Button>
                    ))}
                </div>
            </div>
        ) : null)}

        <Separator />

        <div className="min-h-[400px]">
            {error && (
                <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {isLoading.content && (
                <div className="flex justify-center items-center h-full pt-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            
            {!isLoading.content && chapterContent && (
                <Card onMouseUp={handleSelection} ref={contentRef}>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <CardTitle className="font-headline text-2xl">{chapterContent.reference}</CardTitle>

                          {/* ── Audio Player ── */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {/* Main button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handlePlayAudio}
                              disabled={audioStatus === 'loading'}
                              className="flex items-center gap-2 min-w-[160px] justify-center"
                            >
                              {audioStatus === 'loading' ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  {chunkProgress
                                    ? `Generando (${chunkProgress.current}/${chunkProgress.total})...`
                                    : 'Preparando audio...'}
                                </>
                              ) : audioStatus === 'playing' ? (
                                <>
                                  <Pause className="h-4 w-4" />
                                  Pausar
                                </>
                              ) : audioStatus === 'paused' ? (
                                <>
                                  <Play className="h-4 w-4" />
                                  Continuar
                                </>
                              ) : audioStatus === 'error' ? (
                                <>
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                  Reintentar
                                </>
                              ) : (
                                <>
                                  <Volume2 className="h-4 w-4" />
                                  Escuchar
                                </>
                              )}
                            </Button>

                            {/* Progress bar (shown while playing or paused with audio loaded) */}
                            {audioUrl && (audioStatus === 'playing' || audioStatus === 'paused') && (
                              <div
                                className="w-full min-w-[160px] h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
                                onClick={handleSeek}
                                title="Haz clic para saltar"
                              >
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-300"
                                  style={{ width: `${audioProgress}%` }}
                                />
                              </div>
                            )}

                            {/* Cloud saving indicator */}
                            {isSavingToCloud && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Guardando en la nube...
                              </p>
                            )}

                            {/* Retry cloud save button (shown when audio plays locally but cloud save failed) */}
                            {!isSavingToCloud && hasPendingCloudSave && audioUrl && (audioStatus === 'playing' || audioStatus === 'paused') && (
                              <button
                                onClick={handleRetryCloudSave}
                                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                              >
                                ☁ Reintentar guardar en la nube
                              </button>
                            )}

                            {/* Error message */}
                            {audioStatus === 'error' && audioError && (
                              <p className="text-xs text-destructive text-right max-w-[200px]">{audioError}</p>
                            )}
                          </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="prose prose-lg max-w-none font-body leading-relaxed [&_p]:mb-4"
                            dangerouslySetInnerHTML={{ __html: chapterContent.content }}
                        />
                    </CardContent>
                </Card>
            )}
            
            {selectionRect && (
                <div 
                    style={{
                        position: 'fixed',
                        top: `${selectionRect.top - 40}px`,
                        left: `${selectionRect.left + selectionRect.width / 2 - 20}px`,
                    }}
                >
                    <Button onClick={handleDefine} size="icon" className="rounded-full shadow-lg">
                        <BookOpen className="h-5 w-5" />
                    </Button>
                </div>
            )}
            
            <Dialog open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
                <DialogContent className="sm:max-w-md md:max-w-2xl max-h-[90vh] flex flex-col p-0">
                     <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="font-headline text-2xl">Diccionario y Concordancia</DialogTitle>
                        <DialogDescription>
                            Definición y versículos relacionados para <span className="font-bold">{dictionaryResult?.term}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-headline font-bold mb-2">Definición</h3>
                          {isLoading.dictionary ? (
                              <div className="flex justify-center items-center h-24">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              </div>
                          ) : (
                              <div className="space-y-2 text-base">
                                  <p>{dictionaryResult?.definition}</p>
                                  {dictionaryResult?.reference && (
                                      <blockquote className="mt-4 border-l-2 pl-4 italic">
                                          {dictionaryResult.reference}
                                      </blockquote>
                                  )}
                              </div>
                          )}
                        </div>

                        <Separator />

                        <div>
                          <h3 className="text-lg font-headline font-bold mb-2">Concordancia</h3>
                          {isLoading.concordance ? (
                              <div className="flex justify-center items-center h-48">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              </div>
                          ) : (
                            concordanceResult && concordanceResult.verses.length > 0 ? (
                              <div className="space-y-4">
                                {concordanceResult.verses.map((verse, index) => (
                                  <div key={index}>
                                    <h4 className="font-bold font-headline">{verse.reference}</h4>
                                    <p className="text-muted-foreground">{verse.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground italic">No se encontraron concordancias.</p>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                </DialogContent>
            </Dialog>


            {!isLoading.content && !chapterContent && !error && selectedBook && selectedChapter && (
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">El contenido del capítulo aparecerá aquí.</p>
                </div>
            )}

            {!selectedBook && !error && !isLoading.books &&(
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">Selecciona un libro para ver los capítulos.</p>
                </div>
            )}

            {selectedBook && !selectedChapter && !isLoading.chapters && !isLoading.content && !error &&(
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">Selecciona un capítulo para comenzar a leer.</p>
                </div>
            )}
        </div>
    </div>
  );
}

export function BibleReader() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <BibleReaderContent />
    </Suspense>
  )
}
