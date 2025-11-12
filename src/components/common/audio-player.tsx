
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause, AlertCircle } from 'lucide-react';
import { type TTSOutput } from '@/ai/flows/tts-flow';

interface AudioPlayerProps {
  text?: string | null;
  fetcher?: (text: string) => Promise<TTSOutput | null>;
  onPlay?: () => void;
  autoPlay?: boolean;
  audioSrc: string | null;
  isLoading: boolean;
}

export function AudioPlayer({ text, fetcher, onPlay, autoPlay = false, audioSrc, isLoading }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);

  useEffect(() => {
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      setIsReadyToPlay(true);

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setError('No se pudo reproducir el audio.');
        setIsPlaying(false);
      };

      if (autoPlay) {
        audio.oncanplaythrough = () => {
           if (onPlay) onPlay();
           audio.play().catch(e => {
            console.error("Error playing audio:", e);
            setError("El navegador bloqueó la reproducción automática.");
           });
           setIsPlaying(true);
        }
      }
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, autoPlay]);


  const handlePlayPause = async () => {
    if (!audioRef.current) {
       if (text && fetcher) {
          // This path is for manual play when audioSrc is not pre-loaded
          setError(null);
          try {
            const result = await fetcher(text);
            if (result && result.audio) {
              const audio = new Audio(result.audio);
              audioRef.current = audio;
              if (onPlay) onPlay();
              audio.play();
              setIsPlaying(true);
              audio.onended = () => setIsPlaying(false);
            } else {
              setError('No se pudo generar el audio.');
            }
          } catch (e: any) {
            setError(e.message || 'Ocurrió un error desconocido.');
          }
       }
       return;
    }

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (onPlay) onPlay();
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

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
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isLoading || (!isReadyToPlay && !text)}>
            {icon}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
