
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import { Loader2, Calendar, AlertCircle, Play, Pause, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AudioPlayer } from "@/components/common/audio-player";
import { textToSpeech, type TTSOutput } from "@/ai/flows/tts-flow";
import { trackAiApiCall } from "@/lib/utils";
import { useStudyProgress } from "@/hooks/use-study-progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";


const BIBLE_VERSION_STORAGE_KEY = "bible-version-id";
const BROWSER_VOICE_URI_KEY = 'browser-tts-voice-uri';
const BROWSER_VOICE_RATE_KEY = 'browser-tts-rate';

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
  const [isBrowserPaused, setIsBrowserPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>();
  const [speechRate, setSpeechRate] = useState(1);

  useEffect(() => {
    const isSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    setIsBrowserTtsSupported(isSupported);

    const getVoices = () => {
        if (!isSupported) return;
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length === 0) return;

        const spanishVoices = availableVoices.filter(voice => voice.lang.startsWith('es'));
        const defaultVoices = availableVoices.filter(voice => voice.default);
        setVoices(availableVoices);

        const savedVoiceURI = localStorage.getItem(BROWSER_VOICE_URI_KEY);
        if (savedVoiceURI && availableVoices.some(v => v.voiceURI === savedVoiceURI)) {
            setSelectedVoiceURI(savedVoiceURI);
        } else if (spanishVoices.length > 0) {
            setSelectedVoiceURI(spanishVoices[0].voiceURI);
        } else if (defaultVoices.length > 0) {
            setSelectedVoiceURI(defaultVoices[0].voiceURI);
        } else if (availableVoices.length > 0){
            setSelectedVoiceURI(availableVoices[0].voiceURI);
        }
    };
    
    getVoices();
    if (isSupported) {
        window.speechSynthesis.onvoiceschanged = getVoices;
    }

    const savedRate = localStorage.getItem(BROWSER_VOICE_RATE_KEY);
    if (savedRate) {
        setSpeechRate(parseFloat(savedRate));
    }

    // Cleanup function
    return () => {
        if (isSupported) {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
            }
            window.speechSynthesis.onvoiceschanged = null;
        }
    };
}, [isBrowserTtsSupported]);


  // Stop speaking if text content changes
  useEffect(() => {
      if (isBrowserTtsSupported && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          setIsBrowserSpeaking(false);
          setIsBrowserPaused(false);
      }
  }, [htmlContent, isBrowserTtsSupported]);
  
  // Save settings to localStorage
  useEffect(() => {
    if (selectedVoiceURI) {
        localStorage.setItem(BROWSER_VOICE_URI_KEY, selectedVoiceURI);
    }
  }, [selectedVoiceURI]);

  useEffect(() => {
    localStorage.setItem(BROWSER_VOICE_RATE_KEY, String(speechRate));
  }, [speechRate]);


  const handleBrowserSpeech = () => {
    if (!isBrowserTtsSupported || !textContent) return;

    if (window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsBrowserSpeaking(true);
        setIsBrowserPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsBrowserSpeaking(false);
        setIsBrowserPaused(true);
      }
    } else {
        const utterance = new SpeechSynthesisUtterance(textContent);
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            utterance.lang = 'es-ES';
        }
        utterance.rate = speechRate;
        
        utterance.onstart = () => {
            setIsBrowserSpeaking(true);
            setIsBrowserPaused(false);
        };
        utterance.onend = () => {
            setIsBrowserSpeaking(false);
            setIsBrowserPaused(false);
        };
        utterance.onerror = (e) => {
            console.error("Browser TTS error:", e.error);
            setIsBrowserSpeaking(false);
            setIsBrowserPaused(false);
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
  
  const browserTtsLabel = isBrowserPaused ? "Continuar" : (isBrowserSpeaking ? "Leyendo..." : "Leer con Navegador");

  const BrowserTtsSettings = (
    <Popover>
        <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!isBrowserTtsSupported || isAudioLoading}>
                <Settings className="h-5 w-5" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
            <div className="grid gap-4">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">Ajustes de Voz (Navegador)</h4>
                    <p className="text-sm text-muted-foreground">
                        Controla la voz y la velocidad de la lectura.
                    </p>
                </div>
                <div className="grid gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="voice">Voz</Label>
                        <Select
                            value={selectedVoiceURI}
                            onValueChange={setSelectedVoiceURI}
                            disabled={voices.length === 0}
                        >
                            <SelectTrigger id="voice">
                                <SelectValue placeholder="Seleccionar voz" />
                            </SelectTrigger>
                            <SelectContent>
                                {voices.map(voice => (
                                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                                        {voice.name} ({voice.lang})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                             <Label htmlFor="rate">Velocidad</Label>
                             <span className="text-xs text-muted-foreground">{speechRate.toFixed(1)}x</span>
                        </div>
                        <Slider
                            id="rate"
                            min={0.5}
                            max={2}
                            step={0.1}
                            value={[speechRate]}
                            onValueChange={(value) => setSpeechRate(value[0])}
                        />
                    </div>
                </div>
            </div>
        </PopoverContent>
    </Popover>
);

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
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={handleBrowserSpeech} disabled={!textContent || isAudioLoading}>
                                {isBrowserSpeaking ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                            </Button>
                            <span className="text-sm font-medium text-muted-foreground">{browserTtsLabel}</span>
                            {BrowserTtsSettings}
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
