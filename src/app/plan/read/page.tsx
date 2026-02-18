
"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { Loader2, BookOpen, Speaker } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { textToSpeech, type TTSOutput } from "@/ai/flows/tts-flow";
import { AudioPlayer } from "@/components/common/audio-player";
import { trackAiApiCall } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defineTerm } from "@/ai/flows/dictionary-flow";
import { findConcordance, type ConcordanceOutput } from "@/ai/flows/concordance-flow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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
    const [error, setError] = useState<string | null>(null);

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
                const result = await getPassagesText(reading.passages, BIBLE_VERSION_FOR_TTS);
                if (typeof result === 'object' && result.error) {
                    setError(result.error);
                } else if (typeof result === 'string') {
                    setHtmlContent(result);
                    if (typeof window !== 'undefined') {
                        const tempDiv = document.createElement("div");
                        tempDiv.innerHTML = result.replace(/<h3>/g, '\n\n').replace(/<\/h3>/g, '\n');
                        setTextContent(tempDiv.textContent || tempDiv.innerText || "");
                    }
                }
                setIsTextLoading(false);
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
        setError(null);
        try {
            const result = await textToSpeech({ text });
            if (result?.audio) {
                return result;
            } else {
                setError("No se pudo generar el audio.");
                return null;
            }
        } catch (e: any) {
            const errorMessage = e.message || 'Error generando audio.';
            if (typeof errorMessage === 'string' && errorMessage.includes('429')) {
                setError("Se ha excedido el límite de solicitudes de audio. Por favor, inténtalo de nuevo en un minuto.");
            } else {
                 setError(errorMessage);
            }
            return null;
        } finally {
            setIsAudioLoading(false);
        }
    }, []);

    const handleSelection = () => {
        if (isDictionaryOpen) return;
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? "";
        if (text.length > 2 && text.length < 50 && contentRef.current?.contains(selection?.anchorNode)) {
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
                                {isAudioLoading ? "Generando audio..." : "Escuchar Lectura"}
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

    