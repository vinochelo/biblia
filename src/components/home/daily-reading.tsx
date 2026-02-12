
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import { Loader2, Calendar, AlertCircle, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AudioPlayer } from "@/components/common/audio-player";
import { textToSpeech, type TTSOutput } from "@/ai/flows/tts-flow";
import { trackAiApiCall } from "@/lib/utils";
import { useStudyProgress } from "@/hooks/use-study-progress";
import { Checkbox } from "@/components/ui/checkbox";

const BIBLE_VERSION_STORAGE_KEY = "bible-version-id";

export function DailyReading() {
  const [version, setVersion] = useState(() => {
    if (typeof window === "undefined") {
      return bibleVersions.find(v => v.abbreviation === 'RVR09')?.id || bibleVersions[0].id;
    }
    return localStorage.getItem(BIBLE_VERSION_STORAGE_KEY) || bibleVersions.find(v => v.abbreviation === 'RVR09')?.id || bibleVersions[0].id;
  });

  const [reading, setReading] = useState<Reading | null | undefined>(undefined);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(true);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(new Date());

  const { isCompleted, toggleComplete } = useStudyProgress();
  const [isBrowserTtsSupported, setIsBrowserTtsSupported] = useState(false);
  const [isBrowserSpeaking, setIsBrowserSpeaking] = useState(false);

  useEffect(() => {
    const isSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    setIsBrowserTtsSupported(isSupported);

    // Cleanup function to stop speech when component unmounts
    return () => {
        if (isSupported && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
    };
  }, []);

  // Stop speaking if text content changes
  useEffect(() => {
      if (isBrowserTtsSupported && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          setIsBrowserSpeaking(false);
      }
  }, [htmlContent, isBrowserTtsSupported]);

  const handleBrowserSpeech = () => {
    if (!isBrowserTtsSupported || !textContent) return;

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setIsBrowserSpeaking(false);
    } else {
        const utterance = new SpeechSynthesisUtterance(textContent);
        utterance.lang = 'es-ES';
        utterance.onstart = () => setIsBrowserSpeaking(true);
        utterance.onend = () => setIsBrowserSpeaking(false);
        utterance.onerror = (e) => {
            console.error("Browser TTS error:", e.error);
            setIsBrowserSpeaking(false);
            setError(`Ocurrió un error con la voz del navegador: ${e.error}`);
        };
        window.speechSynthesis.speak(utterance);
    }
  };


  useEffect(() => {
    const today = new Date();
    setToday(today);
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const foundReading = studyPlan.find(r => r.month === month && r.day === day);
    setReading(foundReading);
  }, []);

  useEffect(() => {
    localStorage.setItem(BIBLE_VERSION_STORAGE_KEY, version);
    if (reading === undefined) return;

    const fetchContent = async () => {
      if (reading) {
        setIsTextLoading(true);
        setError(null);
        setHtmlContent(null);
        setTextContent(null);
        
        const result = await getPassagesText(reading.passages, version);
        
        if (typeof result === 'object' && result.error) {
          setError(result.error);
        } else if (typeof result === 'string') {
          setHtmlContent(result);
          // Create text version for TTS on the client
          if (typeof window !== 'undefined') {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = result.replace(/<h3>/g, '\n\n').replace(/<\/h3>/g, '\n');
            setTextContent(tempDiv.textContent || tempDiv.innerText || "");
          }
        }
        setIsTextLoading(false);
      } else {
        setHtmlContent(null);
        setTextContent(null);
        setIsTextLoading(false);
      }
    };

    fetchContent();
  }, [reading, version]);

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

  const todayFormatted = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl md:text-4xl font-headline font-bold">Lectura del Día</h1>
        <p className="text-muted-foreground capitalize">{todayFormatted}</p>
      </div>

      {!reading && !isTextLoading && (
        <Card className="text-center py-10">
          <CardContent className="space-y-4">
             <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-headline font-bold">Día de Descanso</h2>
            <p className="text-muted-foreground">Hoy no hay una lectura asignada en el plan. ¡Aprovecha para descansar o leer libremente!</p>
            <Button asChild>
              <Link href="/plan">Ver Plan de Estudio Completo</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {reading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{reading.passages.join(' • ')}</CardTitle>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id={`reading-${reading.month}-${reading.day}`}
                        checked={isCompleted(reading.month, reading.day)}
                        onCheckedChange={() => toggleComplete(reading.month, reading.day)}
                    />
                    <label
                        htmlFor={`reading-${reading.month}-${reading.day}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Leído
                    </label>
                </div>
            </div>
            <CardDescription>Selecciona la versión de la Biblia que prefieras para la lectura de hoy.</CardDescription>
            <div className="pt-2">
                <Select value={version} onValueChange={setVersion}>
                    <SelectTrigger className="w-full sm:w-[280px]">
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
            </div>
          </CardHeader>
          <CardContent>
            {isTextLoading && (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error al cargar la lectura</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!isTextLoading && htmlContent && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                    <div className="flex items-center gap-4">
                        <AudioPlayer
                            text={textContent}
                            fetcher={handleAudioGeneration}
                            onPlay={() => trackAiApiCall('tts')}
                            isLoading={isAudioLoading}
                        />
                         <span className="text-sm font-medium text-muted-foreground">{isAudioLoading ? "Generando audio..." : "Escuchar Lectura (IA)"}</span>
                    </div>

                    {isBrowserTtsSupported && (
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={handleBrowserSpeech} disabled={!textContent || isAudioLoading}>
                                {isBrowserSpeaking ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                            </Button>
                            <span className="text-sm font-medium text-muted-foreground">{isBrowserSpeaking ? 'Leyendo...' : 'Leer con Navegador'}</span>
                        </div>
                    )}
                </div>
                 <div 
                    className="prose prose-lg max-w-none font-body leading-relaxed text-justify"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                 />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <Button asChild variant="outline">
            <Link href="/plan">
                <Calendar className="mr-2 h-4 w-4" />
                Ver Plan de Estudio Completo
            </Link>
        </Button>
      </div>

    </div>
  );
}
