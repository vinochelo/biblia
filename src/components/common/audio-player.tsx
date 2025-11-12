
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
  isLoading: boolean;
}

export function AudioPlayer({ text, fetcher, onPlay, autoPlay = false, isLoading }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const setupAudio = (src: string) => {
    const audio = new Audio(src);
    audioRef.current = audio;
    setIsReadyToPlay(true);
    setAudioSrc(src);

    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setError('No se pudo reproducir el audio.');
      setIsPlaying(false);
    };

    if (autoPlay) {
        handlePlayPause();
    }
  }

  const handlePlayPause = async () => {
    if (isLoading || isGenerating) return;

    // If audio is already loaded and ready
    if (audioRef.current && isReadyToPlay) {
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(e => {
                 console.error("Error playing audio:", e);
                 setError("El navegador bloqueó la reproducción automática.");
                 setIsPlaying(false);
            });
            setIsPlaying(true);
        }
        return;
    }

    // If we need to generate the audio first
    if (text && fetcher && !audioSrc) {
       setIsGenerating(true);
       setError(null);
       try {
         const result = await fetcher(text);
         if (result && result.audio) {
           if (onPlay) onPlay();
           setupAudio(result.audio);
           // After setup, play it
           const newAudio = new Audio(result.audio);
           newAudio.play();
           setIsPlaying(true);
           newAudio.onended = () => setIsPlaying(false);
           audioRef.current = newAudio;
           setAudioSrc(result.audio);
           setIsReadyToPlay(true);
         } else if (!error) {
           setError('No se pudo generar el audio.');
         }
       } catch (e: any) {
         setError(e.message || 'Ocurrió un error desconocido.');
       } finally {
         setIsGenerating(false);
       }
    }
  };

  let icon = <Play className="h-5 w-5" />;
  if (isLoading || isGenerating) {
    icon = <Loader2 className="h-5 w-5 animate-spin" />;
  } else if (isPlaying) {
    icon = <Pause className="h-5 w-5" />;
  } else if (error) {
    icon = <AlertCircle className="h-5 w-5 text-destructive" />;
  }


  return (
    <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isLoading || isGenerating || !text}>
            {icon}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
