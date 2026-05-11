
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause, Rewind, RotateCcw } from 'lucide-react';
import { type TTSOutput } from '@/ai/flows/tts-flow';

interface AudioPlayerProps {
  text?: string | null;
  fetcher?: (text: string) => Promise<TTSOutput | null>;
  onPlay?: () => void;
  autoPlay?: boolean;
  isLoading: boolean;
}

export function AudioPlayer({ text, fetcher, onPlay, autoPlay = false, isLoading: isParentLoading }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setAudioSrc(null);
    setIsFetching(false);
    abortRef.current = true;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }

    if (text) {
      abortRef.current = false;
    }
  }, [text]);

  const handlePlay = useCallback(() => {
    if (onPlay) {
      onPlay();
    }
  }, [onPlay]);

  const handlePlayPause = useCallback(async () => {
    if (isParentLoading || isFetching) return;

    if (audioRef.current && audioSrc) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.error("Error reproduciendo audio:", e);
          setIsPlaying(false);
        }
      }
      return;
    }

    if (text && fetcher && !audioSrc) {
      abortRef.current = false;
      setIsFetching(true);

      const newAudio = new Audio();
      newAudio.crossOrigin = 'anonymous';
      newAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

      try {
        await newAudio.play().catch(() => {});
      } catch {
        // Ignorar error de audio silencioso
      }

      audioRef.current = newAudio;

      try {
        const result = await fetcher(text);

        if (abortRef.current) {
          return;
        }

        if (result?.audio) {
          setAudioSrc(result.audio);

          if (audioRef.current && !abortRef.current) {
            audioRef.current.src = result.audio;
            audioRef.current.onplay = handlePlay;
            audioRef.current.onended = () => {
              if (!abortRef.current) setIsPlaying(false);
            };
            audioRef.current.onerror = () => {
              console.error('Error reproduciendo audio generado.');
              if (!abortRef.current) setIsPlaying(false);
            };

            try {
              await audioRef.current.play();
              if (!abortRef.current) setIsPlaying(true);
            } catch (e) {
              console.error("Error iniciando reproducción:", e);
              if (!abortRef.current) setIsPlaying(false);
            }
          }
        }
      } catch (e) {
        if (!abortRef.current) {
          console.error("Fetcher falló:", e);
        }
      } finally {
        if (!abortRef.current) {
          setIsFetching(false);
        }
      }
    }
  }, [isParentLoading, isFetching, audioSrc, isPlaying, text, fetcher, handlePlay]);


  const handleRewind = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };


  const getIcon = () => {
    if (isParentLoading || isFetching) {
      return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    return isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />;
  };

  const areControlsDisabled = isParentLoading || isFetching || !audioSrc;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={handleRestart} disabled={areControlsDisabled} aria-label="Empezar de nuevo">
        <RotateCcw className="h-5 w-5" />
      </Button>
      <Button variant="outline" size="icon" onClick={handleRewind} disabled={areControlsDisabled} aria-label="Retroceder 10 segundos">
        <Rewind className="h-5 w-5" />
      </Button>
      <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isParentLoading || isFetching || !text} aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
        {getIcon()}
      </Button>
    </div>
  );
}
