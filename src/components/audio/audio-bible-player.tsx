
"use client";

import { getBooks, getAudioChapters, getAudioChapter } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Book, ChapterSummary, AudioChapter } from "@/lib/types";
import { Loader2, Terminal, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const AUDIO_BIBLE_ID = "6b7f504f1b6050c1-01"; // Switched to NBV which is more likely to be authorized
const LAST_AUDIO_BOOK_STORAGE_KEY = "last-audio-book-id";
const LAST_AUDIO_CHAPTER_STORAGE_KEY = "last-audio-chapter-id";


function AudioBiblePlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterContent, setChapterContent] = useState<AudioChapter | null>(null);
  
  const [isLoading, setIsLoading] = useState({
    books: true,
    chapters: false,
    content: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const fetchChapterContent = useCallback(async (chapterId: string) => {
    setIsLoading(p => ({ ...p, content: true }));
    setError(null);
    setChapterContent(null);

    const response = await getAudioChapter(AUDIO_BIBLE_ID, chapterId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapterContent(response);
    }
    setIsLoading(p => ({ ...p, content: false }));
  }, []);

  const fetchChapters = useCallback(async (bookId: string) => {
    setIsLoading(p => ({ ...p, chapters: true }));
    setError(null);
    setChapters([]);
    
    const response = await getAudioChapters(AUDIO_BIBLE_ID, bookId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapters(response);
      const chapterIdFromUrl = searchParams.get('chapter');
      const lastChapter = localStorage.getItem(LAST_AUDIO_CHAPTER_STORAGE_KEY);
      
      let chapterToSelect = null;
      if (chapterIdFromUrl && chapterIdFromUrl.startsWith(bookId)) {
          chapterToSelect = chapterIdFromUrl;
      } else if (lastChapter && lastChapter.startsWith(bookId)) {
          chapterToSelect = lastChapter;
      }

      if (chapterToSelect && response.some(c => c.id === chapterToSelect)) {
           setSelectedChapter(chapterToSelect);
      } else {
          setSelectedChapter(null);
          setChapterContent(null);
      }
    }
    setIsLoading(p => ({ ...p, chapters: false }));
  }, [searchParams]);

  useEffect(() => {
    setError(null);
    setIsLoading(p => ({ ...p, books: true }));
    
    async function fetchInitialData() {
      const booksResponse = await getBooks(AUDIO_BIBLE_ID);
      if ("error" in booksResponse) {
        setError(booksResponse.error);
        setBooks([]);
      } else {
        setBooks(booksResponse);
        const chapterIdFromUrl = searchParams.get('chapter');
        const bookIdFromUrl = chapterIdFromUrl?.split('.')[0] || searchParams.get('book');
        const lastBook = localStorage.getItem(LAST_AUDIO_BOOK_STORAGE_KEY);
        
        let bookToSelect = bookIdFromUrl || lastBook;

        if (bookToSelect && booksResponse.some(b => b.id === bookToSelect)) {
            setSelectedBook(bookToSelect);
        }
      }
      setIsLoading(p => ({ ...p, books: false }));
    }
    fetchInitialData();
  }, [searchParams]);

  useEffect(() => {
    if (selectedBook) {
        fetchChapters(selectedBook);
    }
  }, [selectedBook, fetchChapters]);

  useEffect(() => {
    if (selectedChapter) {
        fetchChapterContent(selectedChapter);
        router.replace(`/audio?chapter=${selectedChapter}`);
    } else {
      setChapterContent(null);
    }
  }, [selectedChapter, fetchChapterContent, router]);

  const handleBookChange = (bookId: string) => {
    setSelectedBook(bookId);
    setSelectedChapter(null);
    setChapterContent(null);
    localStorage.setItem(LAST_AUDIO_BOOK_STORAGE_KEY, bookId);
    localStorage.removeItem(LAST_AUDIO_CHAPTER_STORAGE_KEY);
    router.push(`/audio?book=${bookId}`);
  };

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapter(chapterId);
    localStorage.setItem(LAST_AUDIO_CHAPTER_STORAGE_KEY, chapterId);
  };
  
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
        setDuration(audioRef.current.duration);
    }
  };
  
  const handleScrub = (value: number[]) => {
      if (audioRef.current) {
          audioRef.current.currentTime = value[0];
          setCurrentTime(value[0]);
      }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const playChapter = (direction: 'next' | 'prev') => {
    if (!selectedChapter || !chapters.length) return;
    const currentIndex = chapters.findIndex(c => c.id === selectedChapter);
    let nextIndex;
    if (direction === 'next') {
        nextIndex = currentIndex + 1;
        if (nextIndex >= chapters.length) return; // No more chapters
    } else {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) return; // No previous chapters
    }
    handleChapterChange(chapters[nextIndex].id);
  }

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select value={selectedBook ?? ""} onValueChange={handleBookChange} disabled={isLoading.books || books.length === 0}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoading.books ? "Cargando..." : "Seleccionar libro"} />
                </SelectTrigger>
                <SelectContent>
                    {books.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                        {b.name}
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={selectedChapter ?? ""} onValueChange={handleChapterChange} disabled={isLoading.chapters || chapters.length === 0}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoading.chapters ? "Cargando..." : "Seleccionar capítulo"} />
                </SelectTrigger>
                <SelectContent>
                    {chapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                        Capítulo {c.number}
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="min-h-[250px] flex items-center justify-center">
            {error && (
                <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {isLoading.content && (
                <div className="flex justify-center items-center h-full pt-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            
            {!isLoading.content && chapterContent && (
                <Card className="w-full">
                    <CardHeader className="text-center">
                        <CardTitle className="font-headline text-2xl">{chapterContent.reference}</CardTitle>
                        <CardDescription>{bibleVersions.find(v => v.id === AUDIO_BIBLE_ID)?.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <audio 
                          ref={audioRef} 
                          src={chapterContent.path} 
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onEnded={() => playChapter('next')}
                          onTimeUpdate={handleTimeUpdate}
                          onLoadedMetadata={handleLoadedMetadata}
                          className="hidden"
                          autoPlay
                        />
                         <div className="flex items-center gap-4">
                           <span className="text-xs font-mono">{formatTime(currentTime)}</span>
                           <Slider 
                                value={[currentTime]} 
                                max={duration} 
                                step={1}
                                onValueChange={handleScrub}
                            />
                            <span className="text-xs font-mono">{formatTime(duration)}</span>
                         </div>
                        <div className="flex justify-center items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => playChapter('prev')} disabled={chapters.findIndex(c => c.id === selectedChapter) === 0}>
                                <SkipBack className="h-6 w-6" />
                            </Button>
                            <Button variant="default" size="icon" onClick={handlePlayPause} className="h-16 w-16 rounded-full">
                                {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => playChapter('next')} disabled={chapters.findIndex(c => c.id === selectedChapter) === chapters.length - 1}>
                                <SkipForward className="h-6 w-6" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!selectedBook && !error && !isLoading.books && (
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4 w-full">
                    <p className="text-muted-foreground">Selecciona un libro para ver los capítulos.</p>
                </div>
            )}

            {selectedBook && !selectedChapter && !isLoading.chapters && !isLoading.content && !error &&(
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4 w-full">
                    <p className="text-muted-foreground">Selecciona un capítulo para comenzar a escuchar.</p>
                </div>
            )}
        </div>
    </div>
  );
}

export function AudioBiblePlayer() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <AudioBiblePlayerContent />
    </Suspense>
  )
}

    