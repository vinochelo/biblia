
"use client";

import { useState, useEffect, useCallback } from "react";
import { getVerse, getBooks, getChapters } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Verse, BibleVersion, Book, ChapterSummary } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Terminal } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { trackApiCall } from "@/lib/utils";
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const BIBLE_VERSION_STORAGE_KEY_COMPARE = "bible-version-id-compare";
const LAST_BOOK_STORAGE_KEY = "last-book-id";
const LAST_CHAPTER_STORAGE_KEY = "last-chapter-id";


export function VerseComparison() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [verseQuery, setVerseQuery] = useState("1");
  const [reference, setReference] = useState<string | null>(null);
  
  const [versions, setVersions] = useState<string[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  const [selectedVersions, setSelectedVersions] = useState<string[]>([
    "592420522e16049f-01", // RV1909
    "6b7f504f1b6050c1-01", // NBV
    "482ddd53705278cc-02", // VBL
  ]);
  const [comparisonResults, setComparisonResults] = useState<
    { version: BibleVersion; verse: Verse | { error: string } }[]
  >([]);

  const [isLoading, setIsLoading] = useState({
    books: false,
    chapters: false,
    content: false,
  });
  const [error, setError] = useState<string | null>(null);

   useEffect(() => {
    const key = localStorage.getItem("bible-api-key") || "hHfw2xKKsVSS1wuy9nGe7";
    setApiKey(key);
    
    const savedCompareVersion = localStorage.getItem(BIBLE_VERSION_STORAGE_KEY_COMPARE);
     if (savedCompareVersion && bibleVersions.some(v => v.id === savedCompareVersion)) {
        setVersions([savedCompareVersion]);
    } else {
        setVersions([bibleVersions[0].id]);
    }

    const lastBook = localStorage.getItem(LAST_BOOK_STORAGE_KEY);
    const lastChapter = localStorage.getItem(LAST_CHAPTER_STORAGE_KEY);

    if (lastBook) setSelectedBook(lastBook);
    if (lastChapter) setSelectedChapter(lastChapter);
    
  }, []);

  const fetchBooks = useCallback(async (versionId: string, key: string) => {
    setIsLoading(p => ({ ...p, books: true }));
    trackApiCall();
    const booksResponse = await getBooks(versionId, key);
    if ("error" in booksResponse) {
        setError(booksResponse.error);
        setBooks([]);
    } else {
        setBooks(booksResponse);
        const lastBook = localStorage.getItem(LAST_BOOK_STORAGE_KEY);
        if (lastBook && booksResponse.some(b => b.id === lastBook)) {
            setSelectedBook(lastBook);
        }
    }
    setIsLoading(p => ({ ...p, books: false }));
  }, []);

  const fetchChapterList = useCallback(async (versionId: string, bookId: string, key: string) => {
    setIsLoading(p => ({ ...p, chapters: true }));
    setChapters([]);
    trackApiCall();
    const response = await getChapters(versionId, bookId, key);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapters(response);
      const lastChapter = localStorage.getItem(LAST_CHAPTER_STORAGE_KEY);
      if(lastChapter && response.some(c => c.id === lastChapter)) {
          setSelectedChapter(lastChapter);
      }
    }
    setIsLoading(p => ({ ...p, chapters: false }));
  }, []);
  
  useEffect(() => {
      if (apiKey && versions.length > 0) {
        fetchBooks(versions[0], apiKey);
      }
  }, [apiKey, versions, fetchBooks]);

  useEffect(() => {
      if (selectedBook && apiKey && versions.length > 0) {
        fetchChapterList(versions[0], selectedBook, apiKey);
      }
  }, [selectedBook, apiKey, versions, fetchChapterList]);


  const handleVersionToggle = (versionId: string) => {
    setSelectedVersions((prev) =>
      prev.includes(versionId)
        ? prev.filter((id) => id !== versionId)
        : [...prev, versionId]
    );
  };
  
  const handleCompare = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    if (!apiKey) {
      setError("Por favor, configura tu clave API en la página de configuración.");
      return;
    }
    if (!selectedBook || !selectedChapter || !verseQuery) {
      setError("Por favor, selecciona libro, capítulo y número de versículo.");
      return;
    }
    if (selectedVersions.length === 0) {
      setError("Por favor, selecciona al menos una versión para comparar.");
      return;
    }

    setIsLoading(p => ({ ...p, content: true }));
    setError(null);
    setComparisonResults([]);

    const verseId = `${selectedChapter}.${verseQuery}`;
    const chapterInfo = chapters.find(c => c.id === selectedChapter);
    const bookInfo = books.find(b => b.id === selectedBook);
    
    if (bookInfo && chapterInfo) {
        setReference(`${bookInfo.name} ${chapterInfo.number}:${verseQuery}`);
    }

    const results = await Promise.all(
      selectedVersions.map(async (versionId) => {
        const version = bibleVersions.find((v) => v.id === versionId)!;
        trackApiCall();
        const verse = await getVerse(versionId, verseId, apiKey);
        if ("error" in verse) {
            // Check if the error is "not found" and provide a friendlier message
            if (typeof verse.error === 'string' && verse.error.toLowerCase().includes('not found')) {
                return { version, verse: { error: `No se encontró en ${version.abbreviation}.` } };
            }
        }
        return { version, verse };
      })
    );

    const firstSuccess = results.find(r => !("error" in r.verse));
    if (!firstSuccess) {
        setError("No se encontró el versículo en ninguna de las versiones seleccionadas. Verifica el número de versículo.");
    } else {
        if (!reference && !("error" in firstSuccess.verse)) {
            setReference(firstSuccess.verse.reference);
        }
    }
    
    setComparisonResults(results);
    setIsLoading(p => ({ ...p, content: false }));
  };

  const handleBookChange = (bookId: string) => {
      setSelectedBook(bookId);
      setSelectedChapter(null);
      localStorage.setItem(LAST_BOOK_STORAGE_KEY, bookId);
      router.push(`/compare?book=${bookId}`, { scroll: false });
  }

  const handleChapterChange = (chapterId: string) => {
      setSelectedChapter(chapterId);
      localStorage.setItem(LAST_CHAPTER_STORAGE_KEY, chapterId);
      const bookId = chapterId.split('.')[0];
      router.push(`/compare?book=${bookId}&chapter=${chapterId}`, { scroll: false });
  }
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-6">
            <form onSubmit={handleCompare} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="book-select" className="font-bold">Libro</Label>
                    <Select value={selectedBook ?? ""} onValueChange={handleBookChange} disabled={isLoading.books || books.length === 0}>
                        <SelectTrigger id="book-select">
                            <SelectValue placeholder={isLoading.books ? "Cargando..." : "Seleccionar libro"} />
                        </SelectTrigger>
                        <SelectContent>
                            {books.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="chapter-select" className="font-bold">Capítulo</Label>
                    <Select value={selectedChapter ?? ""} onValueChange={handleChapterChange} disabled={isLoading.chapters || chapters.length === 0}>
                        <SelectTrigger id="chapter-select">
                            <SelectValue placeholder={isLoading.chapters ? "Cargando..." : "Seleccionar capítulo"} />
                        </SelectTrigger>
                        <SelectContent>
                            {chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.number}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="verse-query" className="font-bold">Versículo</Label>
                    <div className="relative">
                        <Input
                            id="verse-query"
                            name="query"
                            type="number"
                            placeholder="Ej: 1"
                            className="h-11 text-base"
                            value={verseQuery}
                            onChange={(e) => setVerseQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={isLoading.content}>
                    {isLoading.content ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Comparar
                </Button>
            </form>
          
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Versiones</CardTitle>
                    <CardDescription>Selecciona las versiones que deseas comparar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-72">
                        <div className="space-y-2">
                            {bibleVersions.map((version) => (
                            <div key={version.id} className="flex items-center gap-2">
                                <Checkbox
                                id={`version-${version.id}`}
                                checked={selectedVersions.includes(version.id)}
                                onCheckedChange={() => handleVersionToggle(version.id)}
                                />
                                <Label htmlFor={`version-${version.id}`} className="cursor-pointer">
                                {version.abbreviation} - {version.name}
                                </Label>
                            </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>

        <div className="md:col-span-3">
          <div className="min-h-[400px]">
            {isLoading.content && (
              <div className="flex justify-center items-center h-full pt-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {!isLoading.content && comparisonResults.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold font-headline text-center">{reference}</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {comparisonResults.map(({ version, verse }) => (
                            <Card key={version.id}>
                                <CardHeader>
                                    <CardTitle className="font-headline text-xl">{version.abbreviation}</CardTitle>
                                    <CardDescription>{version.name}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {"error" in verse ? (
                                        <p className="text-sm text-destructive">{verse.error}</p>
                                    ) : (
                                        <p className="text-lg leading-relaxed font-body">{verse.text}</p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            {!isLoading.content && !error && comparisonResults.length === 0 && !isLoading.books && (
                <div className="text-center py-20 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground">Los resultados de la comparación aparecerán aquí.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

    