
"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from 'next/navigation';
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { Loader2, BookOpen, Speaker } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { textToSpeech, type TTSOutput } from "@/ai/flows/tts-flow";
import { AudioPlayer } from "@/components/common/audio-player";
import { trackApiCall } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DailyReadingPageContent() {
    const searchParams = useSearchParams();
    const month = searchParams.get('month');
    const day = searchParams.get('day');

    const [reading, setReading] = useState<Reading | null | undefined>(undefined);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isTextLoading, setIsTextLoading] = useState(true);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                const result = await getPassagesText(reading.passages);
                if (typeof result === 'object' && result.error) {
                    setError(result.error);
                } else if (typeof result === 'string') {
                    setTextContent(result);
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

                {!isTextLoading && textContent && (
                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-4">
                                <AudioPlayer
                                    text={textContent}
                                    fetcher={handleAudioGeneration}
                                    onPlay={() => trackApiCall()}
                                    isLoading={isAudioLoading}
                                    autoPlay={false}
                                />
                                {isAudioLoading ? "Generando audio..." : "Escuchar Lectura"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="prose prose-lg max-w-none font-body leading-relaxed text-justify">
                                {textContent.split('\n').map((paragraph, index) => {
                                    if (paragraph.trim().length === 0) return null;
                                    // Check if the paragraph is a title (matches a passage reference)
                                    const isTitle = reading?.passages.some(p => paragraph.trim().startsWith(p)) ?? false;
                                     if (isTitle) {
                                        return <h2 key={index} className="text-2xl font-bold font-headline mt-6 mb-4">{paragraph}</h2>
                                    }
                                    return <p key={index}>{paragraph}</p>
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
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
