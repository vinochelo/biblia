
"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { Loader2, BookOpen, Speaker, Play, Pause, Mic, Sparkles, Volume2, RotateCcw, Rewind, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type TTSOutput } from "@/ai/flows/tts-flow";
import { AudioPlayer } from "@/components/common/audio-player";
import { trackAiApiCall, extractPlainTextFromBibleHtml } from "@/lib/utils";
import { getHumanAudioForChapter, HUMAN_NARRATORS } from "@/lib/human-audio-map";
import { NATURAL_VOICES, DEFAULT_AI_VOICE } from "@/lib/tts-voices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defineTerm } from "@/ai/flows/dictionary-flow";
import { findConcordance, type ConcordanceOutput } from "@/ai/flows/concordance-flow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function parsePassageToChapterIds(passage: string): string[] {
  const bookNames = Object.keys(bookToId).sort((a, b) => b.length - a.length);
  const normalizedPassage = passage.replace(/\s+/g, "");
  for (const bookName of bookNames) {
    const normalizedBookName = bookName.replace(/\s+/g, "");
    if (normalizedPassage.startsWith(normalizedBookName)) {
      const bookId = bookToId[bookName];
      const remaining = normalizedPassage.substring(normalizedBookName.length);
      const chapters = remaining.split(",").map((s) => s.trim()).filter(Boolean);
      return chapters.map((ch) => `${bookId}.${ch}`);
    }
  }
  return [];
}

async function generateAudioViaApi(
  text: string,
  onProgress: (msg: string) => void,
  voice = DEFAULT_AI_VOICE
): Promise<TTSOutput | null> {
  onProgress("Generando con IA Neuronal...");
  const checkRes = await fetch("/api/tts?action=check-cache", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, generateIfMissing: true, forceAi: true, voice }),
  });

  if (!checkRes.ok) {
    const err = await checkRes.json().catch(() => ({ error: checkRes.statusText }));
    throw new Error(err.error || `Error (${checkRes.status}) al generar audio`);
  }

  const checkData = await checkRes.json();

  if (checkData.status === "cached" && checkData.audio) {
    return { audio: checkData.audio };
  }

  // If another process is already generating, wait and poll for the result
  if (checkData.status === "in_progress") {
    onProgress("Generando en el servidor...");
    for (let p = 0; p < 15; p++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch("/api/tts?action=check-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, generateIfMissing: false, forceAi: true, voice }),
      });
      if (pollRes.ok) {
        const pollData = await pollRes.json();
        if (pollData.status === "cached" && pollData.audio) {
          return { audio: pollData.audio };
        }
      }
    }
  }

  throw new Error("La generación tardó demasiado. Inténtalo de nuevo.");
}


function DailyReadingPageContent() {
    const searchParams = useSearchParams();
    const month = searchParams.get('month');
    const day = searchParams.get('day');
    const BIBLE_VERSION_FOR_TTS = '592420522e16049f-01'; // RV1909

    const [reading, setReading] = useState<Reading | null | undefined>(undefined);
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isTextLoading, setIsTextLoading] = useState(true);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [audioProgress, setAudioProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [audioError, setAudioError] = useState<string | null>(null);

    // Human & AI audio state
    const [selectedNarrator, setSelectedNarrator] = useState<string>(() => {
        if (typeof window === "undefined") return "samuel-montoya";
        return localStorage.getItem("preferred_human_narrator") || "samuel-montoya";
    });
    const [selectedAiVoice, setSelectedAiVoice] = useState<string>(() => {
        if (typeof window === "undefined") return DEFAULT_AI_VOICE;
        return localStorage.getItem("preferred_ai_voice") || DEFAULT_AI_VOICE;
    });
    const [dailyChapters, setDailyChapters] = useState<{ id: string; reference: string; audioUrl: string | null }[]>([]);
    const [activeChapterIndex, setActiveChapterIndex] = useState(0);
    const [audioSourceMode, setAudioSourceMode] = useState<'human' | 'ai'>('human');
    const [isHumanPlaying, setIsHumanPlaying] = useState(false);
    const [humanProgress, setHumanProgress] = useState(0);
    const humanAudioRef = useRef<HTMLAudioElement | null>(null);


    // Auto-dismiss audio errors after 8 seconds
    useEffect(() => {
        if (audioError) {
            const timer = setTimeout(() => setAudioError(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [audioError]);

    // Dictionary state
    const contentRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<string>("");
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
    const [dictionaryResult, setDictionaryResult] = useState<{term: string, definition: string, reference?: string} | null>(null);
    const [concordanceResult, setConcordanceResult] = useState<ConcordanceOutput | null>(null);
    const [isAiLoading, setIsAiLoading] = useState({ dictionary: false, concordance: false });

    useEffect(() => {
        if (month && day) {
            const monthNum = parseInt(month, 10);
            const dayNum = parseInt(day, 10);
            const foundReading = studyPlan.find(r => r.month === monthNum && r.day === dayNum);
            setReading(foundReading);
        } else {
            setReading(null);
        }
    }, [month, day]);

    useEffect(() => {
        if (reading === undefined) return;

        const fetchContent = async () => {
            if (reading) {
                setIsTextLoading(true);
                setError(null);
                try {
                    const allChapterIds: string[] = [];
                    for (const passage of reading.passages) {
                        const ids = parsePassageToChapterIds(passage);
                        allChapterIds.push(...ids);
                    }

                    const chaptersData: { id: string; reference: string; audioUrl: string | null }[] = allChapterIds.map(chId => ({
                        id: chId,
                        reference: chId,
                        audioUrl: getHumanAudioForChapter(chId, selectedNarrator),
                    }));
                    setDailyChapters(chaptersData);
                    setActiveChapterIndex(0);

                    const result = await getPassagesText(reading.passages, BIBLE_VERSION_FOR_TTS);
                    if (result && typeof result === 'object' && 'error' in result) {
                        setError(result.error);
                    } else if (typeof result === 'string') {
                        setHtmlContent(result);
                        setTextContent(extractPlainTextFromBibleHtml(result));
                    } else {
                        setError("No se recibió contenido válido de la lectura.");
                    }
                } catch (e: any) {
                    console.error("Error fetching passages:", e);
                    setError(e.message || "Error al cargar la lectura.");
                } finally {
                    setIsTextLoading(false);
                }
            } else {
                setError("No se encontró la lectura para la fecha especificada.");
                setIsTextLoading(false);
            }
        };

        fetchContent();
    }, [reading, selectedNarrator]);

    const handleNarratorChange = (narratorId: string) => {
        setSelectedNarrator(narratorId);
        if (typeof window !== "undefined") {
            localStorage.setItem("preferred_human_narrator", narratorId);
        }
        setDailyChapters((prev) =>
            prev.map((ch) => ({
                ...ch,
                audioUrl: getHumanAudioForChapter(ch.id, narratorId),
            }))
        );
        const activeChId = dailyChapters[activeChapterIndex]?.id;
        const nextUrl = getHumanAudioForChapter(activeChId, narratorId);
        const el = humanAudioRef.current;
        if (el && nextUrl) {
            el.src = nextUrl;
            if (isHumanPlaying) {
                el.play().catch(console.error);
            }
        }
    };


    // Reset audio state when reading changes
    useEffect(() => {
        if (humanAudioRef.current) {
            humanAudioRef.current.pause();
        }
        setIsHumanPlaying(false);
        setHumanProgress(0);
    }, [reading]);

    const activeHumanAudioUrl = dailyChapters[activeChapterIndex]?.audioUrl || null;

    const handleToggleHumanPlay = async () => {
        const el = humanAudioRef.current;
        if (!el || !activeHumanAudioUrl) return;

        if (isHumanPlaying) {
            el.pause();
            setIsHumanPlaying(false);
        } else {
            try {
                if (el.src !== activeHumanAudioUrl) {
                    el.src = activeHumanAudioUrl;
                }
                await el.play();
                setIsHumanPlaying(true);
            } catch (e) {
                console.error("Error playing human audio:", e);
            }
        }
    };

    const handleSelectHumanChapter = async (index: number) => {
        setActiveChapterIndex(index);
        setHumanProgress(0);
        const nextUrl = dailyChapters[index]?.audioUrl;
        const el = humanAudioRef.current;
        if (el && nextUrl) {
            el.src = nextUrl;
            if (isHumanPlaying) {
                try {
                    await el.play();
                } catch (e) {
                    console.error("Error playing next chapter:", e);
                }
            }
        }
    };

    const handleHumanAudioEnded = () => {
        if (activeChapterIndex < dailyChapters.length - 1) {
            handleSelectHumanChapter(activeChapterIndex + 1);
        } else {
            setIsHumanPlaying(false);
        }
    };

    const handleHumanTimeUpdate = () => {
        const el = humanAudioRef.current;
        if (el && el.duration > 0) {
            setHumanProgress((el.currentTime / el.duration) * 100);
        }
    };

    const handleHumanSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = humanAudioRef.current;
        if (!el || !el.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        el.currentTime = ratio * el.duration;
        setHumanProgress(ratio * 100);
    };

    const handleHumanRestart = () => {
        const el = humanAudioRef.current;
        if (el) {
            el.currentTime = 0;
            setHumanProgress(0);
        }
    };

    const handleHumanRewind = () => {
        const el = humanAudioRef.current;
        if (el) {
            el.currentTime = Math.max(0, el.currentTime - 10);
        }
    };

    const handleAudioGeneration = useCallback(async (text: string): Promise<TTSOutput | null> => {
        if (!text) return null;
        setIsAudioLoading(true);
        setAudioProgress("Iniciando con IA...");
        setAudioError(null);
        try {
            const result = await generateAudioViaApi(text, (msg) => setAudioProgress(msg), selectedAiVoice);
            return result;
        } catch (e: any) {
            const errorMessage = e.message || 'Error generando audio.';
            setAudioError(`Audio IA: ${errorMessage}`);
            return null;
        } finally {
            setIsAudioLoading(false);
            setAudioProgress(null);
        }
    }, [selectedAiVoice]);



    const handleSelection = () => {
        if (isDictionaryOpen) return;
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
        setIsAiLoading({ dictionary: true, concordance: true });
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
    
            const [definitionResult, concordanceData] = await Promise.all([
              defineTerm({ term: selection, context }),
              findConcordance({ term: selection, context })
            ]);
    
            setDictionaryResult(definitionResult);
            setIsAiLoading(p => ({ ...p, dictionary: false }));
    
            setConcordanceResult(concordanceData);
            setIsAiLoading(p => ({ ...p, concordance: false }));
    
        } catch (e) {
            console.error(e);
            setDictionaryResult({term: selection, definition: "No se pudo obtener la definición. Inténtalo de nuevo."});
            setConcordanceResult({verses: []});
            setIsAiLoading({ dictionary: false, concordance: false });
        }
    };

    const monthName = month ? new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2024, parseInt(month)-1, 1)) : '';


    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-headline font-bold">
                        Lectura del {day} de {monthName}
                    </h1>
                    {reading && (
                         <p className="text-muted-foreground text-lg">
                            {reading.passages.join(' • ')}
                        </p>
                    )}
                </div>

                {(isTextLoading) && (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="ml-4 text-lg text-muted-foreground">Cargando lectura...</p>
                    </div>
                )}
                
                {error && (
                    <Alert variant="destructive">
                        <BookOpen className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {audioError && !error && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p>{audioError}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0 h-6 px-2 text-xs" onClick={() => setAudioError(null)}>✕</Button>
                    </div>
                )}

                {/* Hidden Human Audio element */}
                <audio
                  ref={humanAudioRef}
                  src={activeHumanAudioUrl || undefined}
                  onTimeUpdate={handleHumanTimeUpdate}
                  onEnded={handleHumanAudioEnded}
                  onError={() => setIsHumanPlaying(false)}
                  style={{ display: 'none' }}
                />

                {!isTextLoading && htmlContent && (
                    <Card>
                         <CardHeader className="space-y-3">
                            {/* Audio Mode Switcher */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-lg text-xs font-medium">
                                  <button
                                    type="button"
                                    onClick={() => setAudioSourceMode('human')}
                                    className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                                      audioSourceMode === 'human'
                                        ? 'bg-background text-foreground shadow-sm font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Voz oficial pregrabada por Samuel Montoya (RVR 1909)"
                                  >
                                    <Mic className="h-3.5 w-3.5 text-primary" />
                                    Locución Humana
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAudioSourceMode('ai')}
                                    className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                                      audioSourceMode === 'ai'
                                        ? 'bg-background text-foreground shadow-sm font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Voz sintética neuronal de Microsoft Edge"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    IA Neuronal
                                  </button>
                                </div>
                            </div>

                            {/* Mode 1: Human Voice Controls */}
                            {audioSourceMode === 'human' && (
                              <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
                                {dailyChapters.length > 1 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs text-muted-foreground font-medium mr-1">Capítulos:</span>
                                    {dailyChapters.map((ch, idx) => (
                                      <Button
                                        key={ch.id}
                                        size="sm"
                                        variant={activeChapterIndex === idx ? 'default' : 'outline'}
                                        className="h-7 text-xs px-2.5"
                                        onClick={() => handleSelectHumanChapter(idx)}
                                      >
                                        {ch.reference || ch.id}
                                      </Button>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleHumanRestart} aria-label="Reiniciar">
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleHumanRewind} aria-label="Retroceder 10s">
                                      <Rewind className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={handleToggleHumanPlay}
                                      disabled={!activeHumanAudioUrl}
                                      className="flex items-center gap-1.5 min-w-[130px] justify-center h-8 text-xs font-medium"
                                    >
                                      {isHumanPlaying ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Reproducir</>}
                                    </Button>
                                  </div>

                                  {/* Narrator Picker */}
                                  <div className="flex items-center gap-1.5">
                                    <Select value={selectedNarrator} onValueChange={handleNarratorChange}>
                                      <SelectTrigger className="h-8 text-xs w-[220px] bg-background">
                                        <SelectValue placeholder="Voz Humana" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {HUMAN_NARRATORS.map((narrator) => (
                                          <SelectItem key={narrator.id} value={narrator.id} className="text-xs">
                                            🎙️ {narrator.name} ({narrator.version})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Progress Bar */}
                                  {activeHumanAudioUrl && (
                                    <div
                                      className="w-full sm:w-48 h-2 bg-muted rounded-full overflow-hidden cursor-pointer ml-auto"
                                      onClick={handleHumanSeek}
                                      title="Haz clic para saltar"
                                    >
                                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${humanProgress}%` }} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}


                            {/* Mode 2: AI Neural Voice Controls */}
                            {audioSourceMode === 'ai' && (
                              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/40">
                                <div className="flex items-center gap-2">
                                  <AudioPlayer
                                      text={textContent}
                                      fetcher={handleAudioGeneration}
                                      onPlay={() => trackAiApiCall('tts')}
                                      isLoading={isAudioLoading}
                                  />
                                  <span className="text-xs md:text-sm font-medium text-muted-foreground">
                                    {isAudioLoading ? (audioProgress || "Generando audio...") : "Voz IA:"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <Select
                                    value={selectedAiVoice}
                                    onValueChange={(val) => {
                                      setSelectedAiVoice(val);
                                      if (typeof window !== "undefined") {
                                        localStorage.setItem("preferred_ai_voice", val);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs w-[220px] bg-background">
                                      <SelectValue placeholder="Seleccionar voz IA" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {NATURAL_VOICES.map((v) => (
                                        <SelectItem key={v.id} value={v.id} className="text-xs">
                                          {v.icon} {v.name} ({v.country})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}

                        </CardHeader>

                        <CardContent>
                             <div 
                                className="prose prose-lg max-w-none font-body leading-relaxed text-justify"
                                dangerouslySetInnerHTML={{ __html: htmlContent || ''}}
                                ref={contentRef}
                                onMouseUp={handleSelection}
                            />
                        </CardContent>
                    </Card>
                )}
            </div>

            {selectionRect && (
                <div 
                    style={{
                        position: 'fixed',
                        top: `${selectionRect.top - 40}px`,
                        left: `${selectionRect.left + selectionRect.width / 2 - 20}px`,
                        zIndex: 10,
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
                        {isAiLoading.dictionary ? (
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
                        {isAiLoading.concordance ? (
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
        </div>
    );
}


export default function DailyReadingPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <DailyReadingPageContent />
        </Suspense>
    )
}

    