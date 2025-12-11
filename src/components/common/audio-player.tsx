
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset state when the text changes to allow re-fetching for new content
  useEffect(() => {
    setIsPlaying(false);
    setAudioSrc(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [text]);

  const handlePlay = useCallback(() => {
    if (onPlay) {
      onPlay();
    }
  }, [onPlay]);

  const handlePlayPause = useCallback(async () => {
    if (isParentLoading) return;

    // If audio is already loaded, just play/pause
    if (audioRef.current && audioSrc) {
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(e => {
                 console.error("Error playing audio:", e);
                 setIsPlaying(false);
            });
            setIsPlaying(true);
        }
        return;
    }

    // If audio is not loaded, generate it first
    if (text && fetcher && !audioSrc) {
       try {
         const result = await fetcher(text); // fetcher now handles loading state and errors
         if (result && result.audio) {
           setAudioSrc(result.audio); // Cache the audio source
           
           const newAudio = new Audio(result.audio);
           audioRef.current = newAudio;

           newAudio.onplay = handlePlay; // Call onPlay only when audio actually starts playing
           newAudio.onended = () => setIsPlaying(false);
           newAudio.onerror = () => {
              console.error('Error playing generated audio.');
              setIsPlaying(false);
           };
           
           await newAudio.play();
           setIsPlaying(true);
         }
       } catch (e) {
         // Error is handled by the parent component that provides the fetcher
         console.error("Fetcher failed:", e);
       }
    }
  }, [isParentLoading, audioSrc, isPlaying, text, fetcher, handlePlay]);


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
    if (isParentLoading) {
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    return isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />;
  };

  const areControlsDisabled = isParentLoading || !audioSrc;

  return (
    <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handleRestart} disabled={areControlsDisabled} aria-label="Empezar de nuevo">
            <RotateCcw className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleRewind} disabled={areControlsDisabled} aria-label="Retroceder 10 segundos">
            <Rewind className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isParentLoading || !text} aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
            {getIcon()}
        </Button>
    </div>
  );
}
