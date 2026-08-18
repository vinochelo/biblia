"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause, Rewind, RotateCcw } from 'lucide-react';
import { type TTSOutput } from '@/ai/flows/tts-flow';
import { getHumanAudioForChapter } from '@/lib/human-audio-map';

interface AudioPlayerProps {
  text?: string | null;
  chapterId?: string | null;
  initialSrc?: string | null;
  fetcher?: (text: string) => Promise<TTSOutput | null>;
  onPlay?: () => void;
  autoPlay?: boolean;
  isLoading: boolean;
}

export function AudioPlayer({
  text,
  chapterId,
  initialSrc,
  fetcher,
  onPlay,
  autoPlay = false,
  isLoading: isParentLoading,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(initialSrc || null);
  const [isFetching, setIsFetching] = useState(false);
  const [isCheckingCache, setIsCheckingCache] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<boolean>(false);

  // Passive check on mount / change
  useEffect(() => {
    setIsPlaying(false);
    setIsFetching(false);
    abortRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    // 1. If explicit initialSrc provided, use it
    if (initialSrc) {
      setAudioSrc(initialSrc);
      return;
    }

    // 2. If chapterId provided, check if human pre-recorded audio exists
    if (chapterId) {
      const humanAudio = getHumanAudioForChapter(chapterId);
      if (humanAudio) {
        setAudioSrc(humanAudio);
        return;
      }
    }

    setAudioSrc(null);

    // 3. If text provided, check server cache passively
    if (text) {
      let isMounted = true;
      setIsCheckingCache(true);

      fetch("/api/tts?action=check-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, chapterId, generateIfMissing: false }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data?.status === "cached" && data.audio) {
            setAudioSrc(data.audio);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsCheckingCache(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [text, chapterId, initialSrc]);

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
    if (isParentLoading || isFetching || isCheckingCache) return;

    const el = audioRef.current;
    if (!el) return;

    // Case A: Audio URL already available (human pre-recorded or cloud cache)
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
          console.error("Error reproduciendo audio:", e);
          setIsPlaying(false);
        }
      }
      return;
    }

    // Case B: Audio needs on-demand generation (user clicked Play)
    if (text && fetcher) {
      abortRef.current = false;
      setIsFetching(true);

      try {
        const result = await fetcher(text);

        if (abortRef.current) return;

        if (result?.audio) {
          setAudioSrc(result.audio);
          el.src = result.audio;

          try {
            await el.play();
            setIsPlaying(true);
          } catch (e) {
            console.warn("Autoplay bloqueado por el navegador. Toca jugar de nuevo.", e);
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
  }, [isParentLoading, isFetching, isCheckingCache, audioSrc, isPlaying, text, fetcher]);

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
    if (isParentLoading || isFetching || isCheckingCache) {
      return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    return isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />;
  };

  const areControlsDisabled = isParentLoading || isFetching || isCheckingCache || !audioSrc;

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        preload="auto"
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
      <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isParentLoading || isFetching || isCheckingCache || (!text && !audioSrc)} aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
        {getIcon()}
      </Button>
    </div>
  );
}


