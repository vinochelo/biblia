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

  // 1. Silent pre-fetch on text change: Check if audio is already cached in Cloudinary/Firebase
  useEffect(() => {
    setIsPlaying(false);
    setAudioSrc(null);
    setIsFetching(false);
    abortRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }

    if (text && fetcher) {
      let isMounted = true;
      fetcher(text).then((res) => {
        if (isMounted && res?.audio) {
          setAudioSrc(res.audio);
        }
      }).catch(() => {
        // Ignorar errores en pre-fetch silencioso
      });

      return () => {
        isMounted = false;
      };
    }
  }, [text, fetcher]);

  const handlePlay = useCallback(() => {
    if (onPlay) {
      onPlay();
    }
    setIsPlaying(true);
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (isParentLoading || isFetching) return;

    const el = audioRef.current;
    if (!el) return;

    // Case A: Audio URL already available (Instant Play on touch for Android & iOS)
    if (audioSrc) {
      if (isPlaying) {
        el.pause();
        setIsPlaying(false);
      } else {
        try {
          if (el.src !== audioSrc) {
            el.src = audioSrc;
          }
          await el.play();
          setIsPlaying(true);
        } catch (e) {
          console.error("Error reproduciendo audio en dispositivo móvil:", e);
          setIsPlaying(false);
        }
      }
      return;
    }

    // Case B: Audio URL needs on-demand generation
    if (text && fetcher) {
      abortRef.current = false;
      setIsFetching(true);

      // Touch gesture priming for mobile browsers
      try {
        el.load();
      } catch {}

      try {
        const result = await fetcher(text);

        if (abortRef.current) return;

        if (result?.audio) {
          setAudioSrc(result.audio);
          el.src = result.audio;
          el.load();

          try {
            await el.play();
            setIsPlaying(true);
          } catch (e) {
            console.warn("Autoplay bloqueado por políticas de navegador móvil. Presione reproducir de nuevo.", e);
            setIsPlaying(false);
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
  }, [isParentLoading, isFetching, audioSrc, isPlaying, text, fetcher]);

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
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={(err) => {
          console.error("Audio element playback error:", err);
          setIsPlaying(false);
        }}
      />
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
