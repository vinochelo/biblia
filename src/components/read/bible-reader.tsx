"use client";

import { getBooks, getChapters, getChapter } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Book, ChapterSummary, Chapter } from "@/lib/types";
import { Loader2, Terminal } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function BibleReader() {
  const [apiKey, setApiKey] = useState<string | null>("hHfw2xKKsVSS1wuy9nGe7");
  const [version, setVersion] = useState(bibleVersions[0].id);
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
    const key = localStorage.getItem("bible-api-key");
    if (key) {
      setApiKey(key);
    }
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setError("Por favor, configura tu clave API en la página de configuración.");
      return;
    }
    setError(null);
    setIsLoading(p => ({ ...p, books: true }));
    setBooks([]);
    setSelectedBook(null);

    async function fetchBooks() {
      const response = await getBooks(version, apiKey!);
      if ("error" in response) {
        setError(response.error);
      } else {
        setBooks(response);
      }
      setIsLoading(p => ({ ...p, books: false }));
    }
    fetchBooks();
  }, [version, apiKey]);

  const handleBookChange = async (bookId: string) => {
    setSelectedBook(bookId);
    setSelectedChapter(null);
    setChapterContent(null);
    setChapters([]);

    if (!apiKey) return;

    setIsLoading(p => ({ ...p, chapters: true }));
    setError(null);
    
    const response = await getChapters(version, bookId, apiKey);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapters(response);
    }
    setIsLoading(p => ({ ...p, chapters: false }));
  };

  const handleChapterChange = async (chapterId: string) => {
    setSelectedChapter(chapterId);
    if (!apiKey) return;

    setIsLoading(p => ({ ...p, content: true }));
    setError(null);
    setChapterContent(null);

    const response = await getChapter(version, chapterId, apiKey);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapterContent(response);
    }
    setIsLoading(p => ({ ...p, content: false }));
  };

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select value={version} onValueChange={setVersion}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar versión" />
                </SelectTrigger>
                <SelectContent>
                    {bibleVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                        {v.abbreviation}
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

            <Select value={selectedChapter ?? ""} onValueChange={handleChapterChange} disabled={!selectedBook || isLoading.chapters}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoading.chapters ? "Cargando..." : "Seleccionar capítulo"} />
                </SelectTrigger>
                <SelectContent>
                    {chapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                        {c.reference}
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <Separator />

        <div className="min-h-[400px]">
            {error && (
                <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {(isLoading.books || isLoading.chapters || isLoading.content) && (
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

            {!isLoading.content && !chapterContent && !error && (
                 <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">El contenido del capítulo aparecerá aquí.</p>
                </div>
            )}
        </div>
    </div>
  );
}
