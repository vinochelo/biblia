
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause, AlertCircle, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  day: number;
  month: number;
  passages: string[];
  fetcher: (passages: string[]) => Promise<string | null>;
  onPlay: () => void;
}

export function AudioPlayer({ day, month, passages, fetcher, onPlay }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup function to stop audio when component unmounts or props change
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setAudioSrc(null);
    };
  }, [day, month]);

  const handlePlayPause = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (audioSrc && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      onPlay(); // Track API call on the client side
      const src = await fetcher(passages);
      if (src) {
        setAudioSrc(src);
        const audio = new Audio(src);
        audioRef.current = audio;
        audio.play();
        setIsPlaying(true);
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
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isLoading} aria-label="Reproducir lectura del día">
            {icon}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
