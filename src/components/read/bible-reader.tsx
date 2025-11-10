
"use client";

import { getBooks, getChapters, getChapter } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Book, ChapterSummary, Chapter } from "@/lib/types";
import { Loader2, Terminal } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const BIBLE_VERSION_STORAGE_KEY = "bible-version-id";

export function BibleReader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chapterFromUrl = searchParams.get('chapter');

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [version, setVersion] = useState<string>(bibleVersions.find(v => v.abbreviation === 'RV1909')?.id || bibleVersions[0].id);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterContent, setChapterContent] = useState<Chapter | null>(null);
  
  const [isLoading, setIsLoading] = useState({
    books: false,
    chapters: false,
    content: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = localStorage.getItem("bible-api-key") || "hHfw2xKKsVSS1wuy9nGe7";
    setApiKey(key);

    const savedVersion = localStorage.getItem(BIBLE_VERSION_STORAGE_KEY);
    if (savedVersion && bibleVersions.some(v => v.id === savedVersion)) {
        setVersion(savedVersion);
    }
  }, []);

  const handleVersionChange = (newVersion: string) => {
    setVersion(newVersion);
    localStorage.setItem(BIBLE_VERSION_STORAGE_KEY, newVersion);
    // Reset selections when version changes
    setSelectedBook(null);
    setChapters([]);
    setSelectedChapter(null);
    setChapterContent(null);
    router.replace(`/read`, { scroll: false });
  };

  const fetchChapterContent = useCallback(async (versionId: string, chapterId: string, key: string) => {
    setIsLoading(p => ({ ...p, content: true }));
    setError(null);
    setChapterContent(null);
    
    // Update URL without reloading page
    router.replace(`/read?chapter=${chapterId}`, { scroll: false });

    const response = await getChapter(versionId, chapterId, key);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapterContent(response);
    }
    setIsLoading(p => ({ ...p, content: false }));
  }, [router]);

  const fetchChapters = useCallback(async (versionId: string, bookId: string, key: string) => {
    setIsLoading(p => ({ ...p, chapters: true }));
    setError(null);
    setChapters([]);
    
    const response = await getChapters(versionId, bookId, key);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapters(response);
      const chapterFromUrlExists = response.some(c => c.id === chapterFromUrl);
      if (chapterFromUrl && chapterFromUrl.startsWith(bookId) && chapterFromUrlExists) {
           setSelectedChapter(chapterFromUrl);
           // Content will be fetched in the main useEffect
      } else {
          setSelectedChapter(null);
          setChapterContent(null);
      }
    }
    setIsLoading(p => ({ ...p, chapters: false }));
  }, [chapterFromUrl]);

  useEffect(() => {
    if (!apiKey) {
      setError("Por favor, configura tu clave API en la página de configuración.");
      return;
    }
    setError(null);
    setIsLoading(p => ({ ...p, books: true }));
    
    async function fetchInitialData() {
      const booksResponse = await getBooks(version, apiKey!);
      if ("error" in booksResponse) {
        setError(booksResponse.error);
        setBooks([]);
      } else {
        setBooks(booksResponse);
        if (chapterFromUrl) {
            const bookIdFromUrl = chapterFromUrl.split('.')[0];
            if (booksResponse.some(b => b.id === bookIdFromUrl)) {
                setSelectedBook(bookIdFromUrl);
            }
        }
      }
      setIsLoading(p => ({ ...p, books: false }));
    }
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, apiKey]);

  useEffect(() => {
    if (selectedBook && apiKey) {
        fetchChapters(version, selectedBook, apiKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBook, version, apiKey]);

  useEffect(() => {
    if (selectedChapter && apiKey) {
        fetchChapterContent(version, selectedChapter, apiKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter, version, apiKey]);

  const handleBookChange = (bookId: string) => {
    setSelectedBook(bookId);
    setSelectedChapter(null);
    setChapterContent(null);
    router.replace(`/read?book=${bookId}`, { scroll: false });
  };

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapter(chapterId);
  };

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select value={version} onValueChange={handleVersionChange}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar versión" />
                </SelectTrigger>
                <SelectContent>
                    {bibleVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                        {v.abbreviation} ({v.name})
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>

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
        </div>

        {selectedBook && (isLoading.chapters ? (
             <div className="flex justify-center items-center h-full pt-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
        ) : chapters.length > 0 ? (
            <div className="space-y-4 pt-4">
                <h3 className="text-xl font-headline font-bold text-center">Selecciona un Capítulo</h3>
                <div className="flex flex-wrap justify-center gap-2">
                    {chapters.map((c) => (
                        <Button
                            key={c.id}
                            variant={selectedChapter === c.id ? "default" : "outline"}
                            onClick={() => handleChapterChange(c.id)}
                            className="w-12 h-12 text-lg"
                        >
                            {c.number}
                        </Button>
                    ))}
                </div>
            </div>
        ) : null)}

        <Separator />

        <div className="min-h-[400px]">
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
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">{chapterContent.reference}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="prose prose-lg max-w-none font-body leading-relaxed [&_h3]:font-headline [&_h3]:font-bold [&_h3]:text-xl [&_p]:mb-4"
                            dangerouslySetInnerHTML={{ __html: chapterContent.content }}
                        />
                    </CardContent>
                </Card>
            )}

            {!isLoading.content && !chapterContent && !error && selectedBook && selectedChapter && (
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">El contenido del capítulo aparecerá aquí.</p>
                </div>
            )}

            {!selectedBook && !error && !isLoading.books &&(
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">Selecciona un libro para ver los capítulos.</p>
                </div>
            )}

            {selectedBook && !selectedChapter && !isLoading.chapters && !isLoading.content && !error &&(
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">Selecciona un capítulo para comenzar a leer.</p>
                </div>
            )}
        </div>
    </div>
  );
}

    