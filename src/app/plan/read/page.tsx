
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from 'next/navigation';
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { Loader2, BookOpen } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { textToSpeech } from "@/ai/flows/tts-flow";
import { AudioPlayer } from "@/components/common/audio-player";
import { trackApiCall } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DailyReadingPageContent() {
    const searchParams = useSearchParams();
    const month = searchParams.get('month');
    const day = searchParams.get('day');

    const [reading, setReading] = useState<Reading | null | undefined>(undefined);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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
                setIsLoading(true);
                setError(null);
                const result = await getPassagesText(reading.passages);
                if (typeof result === 'object' && result.error) {
                    setError(result.error);
                } else if (typeof result === 'string') {
                    setTextContent(result);
                }
                setIsLoading(false);
            } else {
                setError("No se encontró la lectura para la fecha especificada.");
                setIsLoading(false);
            }
        };

        fetchContent();
    }, [reading]);

    const handleAudioGeneration = async (text: string) => {
        trackApiCall(); // For TTS
        return await textToSpeech({ text });
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

                {isLoading && (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="ml-4 text-lg text-muted-foreground">Cargando lectura...</p>
                    </div>
                )}
                
                {error && (
                    <Alert variant="destructive">
                        <BookOpen className="h-4 w-4" />
                        <AlertTitle>Error al cargar la lectura</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {!isLoading && textContent && (
                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-4">
                                <AudioPlayer
                                    text={textContent}
                                    fetcher={() => handleAudioGeneration(textContent)}
                                    onPlay={() => {}} 
                                    autoPlay={true}
                                />
                                Reproduciendo Lectura
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="prose prose-lg max-w-none font-body leading-relaxed text-justify">
                                {textContent.split('\n').map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
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
