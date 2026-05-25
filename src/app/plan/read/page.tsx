
"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { Loader2, BookOpen, Speaker } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type TTSOutput } from "@/ai/flows/tts-flow";
import { AudioPlayer } from "@/components/common/audio-player";
import { AlertCircle } from "lucide-react";
import { trackAiApiCall } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defineTerm } from "@/ai/flows/dictionary-flow";
import { findConcordance, type ConcordanceOutput } from "@/ai/flows/concordance-flow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

async function generateAudioViaApi(
  text: string,
  onProgress: (msg: string) => void
): Promise<TTSOutput | null> {
  // Step 1: Check cache
  onProgress("Verificando caché...");
  const checkRes = await fetch("/api/tts?action=check-cache", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!checkRes.ok) {
    const err = await checkRes.json().catch(() => ({ error: "Error verificando caché" }));
    throw new Error(err.error || "Error verificando caché");
  }
  const checkData = await checkRes.json();

  if (checkData.status === "cached" && checkData.audio) {
    return { audio: checkData.audio };
  }

  // Step 2: Generate each chunk individually
  const chunks: string[] = checkData.chunks || [];
  if (chunks.length === 0) throw new Error("No se encontraron fragmentos para generar");

  const pcmParts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress(`Generando ${i + 1}/${chunks.length}...`);

    let chunkSuccess = false;
    for (let retry = 0; retry < 3; retry++) {
      try {
        const chunkRes = await fetch("/api/tts?action=generate-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chunkText: chunks[i],
            chunkIndex: i,
            totalChunks: chunks.length,
          }),
        });

        if (chunkRes.status === 429) {
          // Rate limited, wait and retry
          onProgress(`Límite de API, esperando... (${i + 1}/${chunks.length})`);
          await new Promise((r) => setTimeout(r, 5000 * (retry + 1)));
          continue;
        }

        if (!chunkRes.ok) {
          const errData = await chunkRes.json().catch(() => ({ error: "Error generando chunk" }));
          if (errData.retryable && retry < 2) {
            await new Promise((r) => setTimeout(r, 3000 * (retry + 1)));
            continue;
          }
          throw new Error(errData.error || "Error generando audio");
        }

        const chunkData = await chunkRes.json();
        pcmParts.push(chunkData.pcmBase64);
        chunkSuccess = true;
        break;
      } catch (e: any) {
        if (retry === 2) throw e;
        await new Promise((r) => setTimeout(r, 2000 * (retry + 1)));
      }
    }

    if (!chunkSuccess) {
      throw new Error(`Falló la generación del fragmento ${i + 1}`);
    }

    // Small delay between chunks
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Step 3: Finalize - combine and cache
  onProgress("Guardando...");
  const finalRes = await fetch("/api/tts?action=finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, pcmParts }),
  });

  if (!finalRes.ok) {
    const errData = await finalRes.json().catch(() => ({ error: "Error finalizando audio" }));
    throw new Error(errData.error || "Error guardando audio");
  }

  const finalData = await finalRes.json();
  return { audio: finalData.audio };
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
                    const result = await getPassagesText(reading.passages, BIBLE_VERSION_FOR_TTS);
                    if (result && typeof result === 'object' && 'error' in result) {
                        setError(result.error);
                    } else if (typeof result === 'string') {
                        setHtmlContent(result);
                        if (typeof window !== 'undefined') {
                            const tempDiv = document.createElement("div");
                            tempDiv.innerHTML = result.replace(/<h3>/g, '\n\n').replace(/<\/h3>/g, '\n');
                            // REMOVE VERSE SPANS BEFORE TEXT EXTRACTION:
                            const verseSpans = tempDiv.querySelectorAll('span.v');
                            verseSpans.forEach(span => span.remove());
                            setTextContent(tempDiv.textContent || tempDiv.innerText || "");
                        }
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
    }, [reading]);

    const handleAudioGeneration = useCallback(async (text: string): Promise<TTSOutput | null> => {
        if (!text) return null;
        setIsAudioLoading(true);
        setAudioProgress("Iniciando...");
        setAudioError(null);
        try {
            const result = await generateAudioViaApi(text, (msg) => setAudioProgress(msg));
            return result;
        } catch (e: any) {
            const errorMessage = e.message || 'Error generando audio.';
            if (typeof errorMessage === 'string' && (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('cuota') || errorMessage.includes('límite') || errorMessage.includes('Resource has been exhausted'))) {
                setAudioError("Se agotó la cuota diaria del Audio IA. Puedes usar el lector del sistema o intentarlo más tarde.");
            } else {
                setAudioError(`Audio IA: ${errorMessage}`);
            }
            return null;
        } finally {
            setIsAudioLoading(false);
            setAudioProgress(null);
        }
    }, []);

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

                {!isTextLoading && htmlContent && (
                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-4">
                                <AudioPlayer
                                    text={textContent}
                                    fetcher={handleAudioGeneration}
                                    onPlay={() => trackAiApiCall('tts')}
                                    isLoading={isAudioLoading}
                                />
                                {isAudioLoading ? (audioProgress || "Generando audio...") : "Escuchar Lectura"}
                            </CardTitle>
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

    