
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause } from 'lucide-react';
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
           if (onPlay) onPlay();
           
           setAudioSrc(result.audio); // Cache the audio source
           
           const newAudio = new Audio(result.audio);
           audioRef.current = newAudio;

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
  }, [isParentLoading, audioSrc, isPlaying, text, fetcher, onPlay]);


  const getIcon = () => {
    if (isParentLoading) {
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    return isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />;
  };


  return (
    <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isParentLoading || !text}>
            {getIcon()}
        </Button>
    </div>
  );
}
