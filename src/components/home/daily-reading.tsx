
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { studyPlan, type Reading } from "@/lib/study-plan";
import { getPassagesText } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import { Loader2, Calendar, AlertCircle, Play, Pause, Settings, BookOpen, Type, Minus, Plus } from "lucide-react";
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
import { defineTerm } from "@/ai/flows/dictionary-flow";
import { findConcordance, type ConcordanceOutput } from "@/ai/flows/concordance-flow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";


const BIBLE_VERSION_STORAGE_KEY = "bible-version-id";
const BROWSER_VOICE_URI_KEY = 'browser-tts-voice-uri';
const BROWSER_VOICE_RATE_KEY = 'browser-tts-rate';
const FONT_SIZE_KEY = 'reader-font-size';

type FontSize = 'sm' | 'md' | 'lg';
const FONT_SIZE_LABELS: Record<FontSize, string> = { sm: 'Pequeña', md: 'Mediana', lg: 'Grande' };
const FONT_SIZES: FontSize[] = ['sm', 'md', 'lg'];

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
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === 'undefined') return 'md';
    return (localStorage.getItem(FONT_SIZE_KEY) as FontSize) || 'md';
  });

  // Dictionary state
  const contentRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<string>("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<{term: string, definition: string, reference?: string} | null>(null);
  const [concordanceResult, setConcordanceResult] = useState<ConcordanceOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState({ dictionary: false, concordance: false });

  // Effect for setting up browser TTS
  useEffect(() => {
    const isSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    setIsBrowserTtsSupported(isSupported);
    if (!isSupported) return;

    const loadAndSetVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length === 0) return; // Wait for onvoiceschanged

        const spanishVoices = availableVoices.filter(voice => voice.lang.startsWith('es'));
        setVoices(spanishVoices);

        const savedVoiceURI = localStorage.getItem(BROWSER_VOICE_URI_KEY);
        
        if (spanishVoices.length > 0) {
            if (savedVoiceURI && spanishVoices.some(v => v.voiceURI === savedVoiceURI)) {
                setSelectedVoiceURI(savedVoiceURI);
            } else {
                setSelectedVoiceURI(spanishVoices[0].voiceURI);
            }
        } else {
            setSelectedVoiceURI(undefined);
        }
    };
    
    window.speechSynthesis.onvoiceschanged = loadAndSetVoices;
    loadAndSetVoices();

    const savedRate = localStorage.getItem(BROWSER_VOICE_RATE_KEY);
    if (savedRate) setSpeechRate(parseFloat(savedRate));

    return () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.onvoiceschanged = null;
        }
    };
  }, []);


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

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  const cycleFontSize = (direction: 'up' | 'down') => {
    const idx = FONT_SIZES.indexOf(fontSize);
    if (direction === 'up' && idx < FONT_SIZES.length - 1) setFontSize(FONT_SIZES[idx + 1]);
    if (direction === 'down' && idx > 0) setFontSize(FONT_SIZES[idx - 1]);
  };

  const handleBrowserSpeech = () => {
    if (!isBrowserTtsSupported || !textContent) return;
    const speech = window.speechSynthesis;

    if (speech.speaking && !speech.paused) {
        speech.pause();
        setIsBrowserSpeaking(false);
        setIsBrowserPaused(true);
    } else if (speech.paused) {
        speech.resume();
        setIsBrowserSpeaking(true);
        setIsBrowserPaused(false);
    } else {
        speech.cancel(); // Cancel any stuck utterance
        
        const utterance = new SpeechSynthesisUtterance(textContent);
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        
        if (voice) {
            utterance.voice = voice;
        } else {
            setError("No hay una voz en español seleccionada. Revisa los ajustes de voz del navegador.");
            return;
        }
        
        utterance.lang = 'es-ES';
        utterance.rate = speechRate;
        
        utterance.onstart = () => {
            setIsBrowserSpeaking(true);
            setIsBrowserPaused(false);
            setError(null);
        };
        utterance.onend = () => {
            setIsBrowserSpeaking(false);
            setIsBrowserPaused(false);
        };
        utterance.onerror = (e) => {
            console.error("Browser TTS error:", e.error);
            setIsBrowserSpeaking(false);
            setIsBrowserPaused(false);
            setError(`Error de la voz del navegador: ${e.error}`);
        };
        
        speech.speak(utterance);
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


  const todayFormatted = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const browserTtsLabel = isBrowserPaused ? "Continuar" : (isBrowserSpeaking ? "Pausar" : "Leer con Navegador");

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
                                <SelectValue placeholder={voices.length === 0 ? "No hay voces en español" : "Seleccionar voz"} />
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
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-sans">Plan de Lectura</p>
        <h1 className="text-3xl md:text-4xl font-headline font-bold">Lectura del Día</h1>
        <p className="text-muted-foreground capitalize text-sm md:text-base">{todayFormatted}</p>
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
        <Card className="shadow-lg border-border/50 overflow-hidden">
          <CardHeader className="bg-gradient-to-b from-primary/5 to-transparent pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg md:text-xl">{reading.passages.join(' • ')}</CardTitle>
                <div className="flex items-center space-x-2 shrink-0">
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
            <div className="pt-3">
                <Select value={version} onValueChange={setVersion}>
                    <SelectTrigger className="w-full sm:w-[280px] bg-background/80">
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
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
                    {/* Audio IA */}
                    <div className="flex items-center gap-2">
                        <AudioPlayer
                            text={textContent}
                            fetcher={handleAudioGeneration}
                            onPlay={() => trackAiApiCall('tts')}
                            isLoading={isAudioLoading}
                        />
                         <span className="text-xs md:text-sm font-medium text-muted-foreground hidden sm:inline">{isAudioLoading ? "Generando..." : "Audio IA"}</span>
                    </div>

                    {/* Browser TTS */}
                    {isBrowserTtsSupported && (
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleBrowserSpeech} disabled={!textContent || isAudioLoading}>
                                {isBrowserSpeaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">{browserTtsLabel}</span>
                            {BrowserTtsSettings}
                        </div>
                    )}

                    {/* Font Size Controls */}
                    <div className="flex items-center gap-1.5 ml-auto">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => cycleFontSize('down')}
                            disabled={fontSize === 'sm'}
                            aria-label="Reducir tamaño de letra"
                        >
                            <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs font-sans font-medium text-muted-foreground w-8 text-center select-none">
                            <Type className="h-3.5 w-3.5 inline" />
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => cycleFontSize('up')}
                            disabled={fontSize === 'lg'}
                            aria-label="Aumentar tamaño de letra"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Bible text content */}
                 <div 
                    className={`prose max-w-none font-body text-justify reader-text-${fontSize}`}
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                    ref={contentRef}
                    onMouseUp={handleSelection}
                    onTouchEnd={handleSelection}
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

    