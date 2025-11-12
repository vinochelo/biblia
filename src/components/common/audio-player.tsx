
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause, AlertCircle } from 'lucide-react';
import { type TTSOutput } from '@/ai/flows/tts-flow';

interface AudioPlayerProps {
  text: string;
  fetcher: (text: string) => Promise<TTSOutput | null>;
  onPlay: () => void;
  autoPlay?: boolean;
}

export function AudioPlayer({ text, fetcher, onPlay, autoPlay = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const hasTriggeredAutoPlay = useRef(false);


  const handlePlayPause = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (audioSrc && audioRef.current) {
      onPlay();
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcher(text);
      if (result && result.audio) {
        setAudioSrc(result.audio);
        const audio = new Audio(result.audio);
        audioRef.current = audio;
        
        audio.oncanplaythrough = () => {
          onPlay(); 
          audio.play();
          setIsPlaying(true);
        };

        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => {
          setError('No se pudo reproducir el audio.');
          setIsPlaying(false);
        };
      } else {
        setError('No se pudo generar el audio.');
      }
    } catch (e: any) {
      setError(e.message || 'Ocurrió un error desconocido.');
    } finally {
      setIsLoading(false);
    }
  };
  
   useEffect(() => {
    if (autoPlay && text && !hasTriggeredAutoPlay.current && !isLoading) {
      hasTriggeredAutoPlay.current = true;
      handlePlayPause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, text, isLoading]);


  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);


  let icon = <Play className="h-5 w-5" />;
  if (isLoading) {
    icon = <Loader2 className="h-5 w-5 animate-spin" />;
  } else if (isPlaying) {
    icon = <Pause className="h-5 w-5" />;
  } else if (error) {
    icon = <AlertCircle className="h-5 w-5 text-destructive" />;
  }


  return (
    <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isLoading || !text}>
            {icon}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
