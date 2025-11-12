
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
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

export function AudioPlayer({ text, fetcher, onPlay, autoPlay = false, isLoading: isParentLoading }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset state when the text changes
  useEffect(() => {
    setIsPlaying(false);
    setError(null);
    setAudioSrc(null);
    setIsGenerating(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [text]);

  const handlePlayPause = useCallback(async () => {
    if (isParentLoading || isGenerating) return;

    // If audio is already loaded, just play/pause
    if (audioRef.current && audioSrc) {
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(e => {
                 console.error("Error playing audio:", e);
                 setError("El navegador bloqueó la reproducción.");
                 setIsPlaying(false);
            });
            setIsPlaying(true);
        }
        return;
    }

    // If audio is not loaded, generate it first
    if (text && fetcher && !audioSrc) {
       setIsGenerating(true);
       setError(null);
       try {
         const result = await fetcher(text);
         if (result && result.audio) {
           if (onPlay) onPlay(); // Track API call only on successful generation
           
           setAudioSrc(result.audio); // Cache the audio source
           
           const newAudio = new Audio(result.audio);
           audioRef.current = newAudio;

           newAudio.onended = () => setIsPlaying(false);
           newAudio.onerror = () => {
              setError('No se pudo reproducir el audio.');
              setIsPlaying(false);
           };
           
           await newAudio.play();
           setIsPlaying(true);

         } else if (!error) { // Ensure we don't overwrite a specific error from the fetcher
           setError('No se pudo generar el audio.');
         }
       } catch (e: any) {
         setError(e.message || 'Ocurrió un error desconocido.');
       } finally {
         setIsGenerating(false);
       }
    }
  }, [isParentLoading, isGenerating, audioSrc, isPlaying, text, fetcher, onPlay, error]);


  const getIcon = () => {
    if (isParentLoading || isGenerating) {
        return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    if (isPlaying) {
        return <Pause className="h-5 w-5" />;
    }
    if (error) {
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
    return <Play className="h-5 w-5" />;
  };


  return (
    <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={isParentLoading || isGenerating || !text}>
            {getIcon()}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
