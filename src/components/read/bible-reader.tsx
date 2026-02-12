
"use client";

import { getBooks, getChapters, getChapter } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Book, ChapterSummary, Chapter } from "@/lib/types";
import { Loader2, Terminal, BookOpen } from "lucide-react";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { defineTerm } from "@/ai/flows/dictionary-flow";
import { findConcordance, type ConcordanceOutput } from "@/ai/flows/concordance-flow";
import { trackApiCall, trackAiApiCall } from "@/lib/utils";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import Link from "next/link";

const BIBLE_VERSION_STORAGE_KEY = "bible-version-id";
const LAST_BOOK_STORAGE_KEY = "last-book-id";
const LAST_CHAPTER_STORAGE_KEY = "last-chapter-id";

function BibleReaderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [version, setVersion] = useState<string>(() => {
    if (typeof window === 'undefined') return bibleVersions[0].id;
    return localStorage.getItem(BIBLE_VERSION_STORAGE_KEY) || bibleVersions[0].id;
  });

  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterContent, setChapterContent] = useState<Chapter | null>(null);
  
  const [isLoading, setIsLoading] = useState({
    books: true,
    chapters: false,
    content: false,
    dictionary: false,
    concordance: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Dictionary state
  const [selection, setSelection] = useState<string>("");
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<{term: string, definition: string, reference?: string} | null>(null);
  const [concordanceResult, setConcordanceResult] = useState<ConcordanceOutput | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);


  const handleVersionChange = (newVersion: string) => {
    setVersion(newVersion);
    localStorage.setItem(BIBLE_VERSION_STORAGE_KEY, newVersion);
    // Reset selections when version changes
    setSelectedBook(null);
    setChapters([]);
    setSelectedChapter(null);
    setChapterContent(null);
    router.push(`/read`);
  };

  const handleBookChange = (bookId: string) => {
    setSelectedBook(bookId);
    localStorage.setItem(LAST_BOOK_STORAGE_KEY, bookId);
    // Reset chapter when book changes
    setSelectedChapter(null);
    setChapterContent(null);
    localStorage.removeItem(LAST_CHAPTER_STORAGE_KEY);
    router.push(`/read?book=${bookId}`);
  };

  const handleChapterChange = (chapterId: string) => {
    setSelectedChapter(chapterId);
    localStorage.setItem(LAST_CHAPTER_STORAGE_KEY, chapterId);
    router.push(`/read?chapter=${chapterId}`);
  };

  const fetchBooks = useCallback(async (versionId: string) => {
    setIsLoading(p => ({ ...p, books: true }));
    setError(null);
    trackApiCall();
    const booksResponse = await getBooks(versionId);
    if ("error" in booksResponse) {
      setError(booksResponse.error);
    } else {
      setBooks(booksResponse);
      // Determine which book to select
      const chapterIdFromUrl = searchParams.get('chapter');
      const bookIdFromUrl = chapterIdFromUrl?.split('.')[0] || searchParams.get('book');
      const lastBook = localStorage.getItem(LAST_BOOK_STORAGE_KEY);
      const bookToSelect = bookIdFromUrl || lastBook;
      if (bookToSelect && booksResponse.some(b => b.id === bookToSelect)) {
        setSelectedBook(bookToSelect);
      } else {
        // If no valid book is found, we don't select one
        setSelectedBook(null);
      }
    }
    setIsLoading(p => ({ ...p, books: false }));
  }, [searchParams]);

  const fetchChapters = useCallback(async (versionId: string, bookId: string) => {
    setIsLoading(p => ({ ...p, chapters: true }));
    setError(null);
    trackApiCall();
    const response = await getChapters(versionId, bookId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapters(response);
      // Determine which chapter to select
      const chapterIdFromUrl = searchParams.get('chapter');
      const lastChapter = localStorage.getItem(LAST_CHAPTER_STORAGE_KEY);
      const chapterToSelect = chapterIdFromUrl || (lastChapter && lastChapter.startsWith(bookId) ? lastChapter : null);
      if (chapterToSelect && response.some(c => c.id === chapterToSelect)) {
        setSelectedChapter(chapterToSelect);
      } else {
        setSelectedChapter(null);
      }
    }
    setIsLoading(p => ({ ...p, chapters: false }));
  }, [searchParams]);
  
  const fetchChapterContent = useCallback(async (versionId: string, chapterId: string) => {
    setIsLoading(p => ({ ...p, content: true }));
    setError(null);
    setChapterContent(null);
    trackApiCall();
    const response = await getChapter(versionId, chapterId);
    if ("error" in response) {
      setError(response.error);
    } else {
      setChapterContent(response);
    }
    setIsLoading(p => ({ ...p, content: false }));
  }, []);

  // Main data fetching logic
  useEffect(() => {
    fetchBooks(version);
  }, [version, fetchBooks]);

  useEffect(() => {
    if (selectedBook) {
      fetchChapters(version, selectedBook);
    } else {
      // Clear dependent state if no book is selected
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [selectedBook, version, fetchChapters]);

  useEffect(() => {
    if (selectedChapter) {
      fetchChapterContent(version, selectedChapter);
    } else {
      // Clear content if no chapter is selected
      setChapterContent(null);
    }
  }, [selectedChapter, version, fetchChapterContent]);
  
  const handleSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (text.length > 2 && text.length < 50 && contentRef.current?.contains(selection?.anchorNode)) {
      setSelection(text);
      const range = selection?.getRangeAt(0);
      if (range) {
        setSelectionRect(range.getBoundingClientRect());
      }
    } else {
      setSelection("");
      setSelectionRect(null);
    }
  };

  const handleDefine = async () => {
    if (!selection) return;
    setIsLoading(p => ({ ...p, dictionary: true, concordance: true }));
    setDictionaryResult(null);
    setConcordanceResult(null);
    setIsDictionaryOpen(true);
    setSelectionRect(null);

    trackAiApiCall('dictionary');

    try {
        const sel = window.getSelection();
        const range = sel?.getRangeAt(0);
        let context = '';
        if (range) {
            const parentElement = range.startContainer.parentElement;
            context = parentElement?.textContent || '';
        }

        // Fetch definition and concordance in parallel
        const [definitionResult, concordanceData] = await Promise.all([
          defineTerm({ term: selection, context }),
          findConcordance({ term: selection, context })
        ]);

        setDictionaryResult(definitionResult);
        setIsLoading(p => ({ ...p, dictionary: false }));

        setConcordanceResult(concordanceData);
        setIsLoading(p => ({ ...p, concordance: false }));

    } catch (e) {
        console.error(e);
        setDictionaryResult({term: selection, definition: "No se pudo obtener la definición. Inténtalo de nuevo."});
        setConcordanceResult({verses: []});
        setIsLoading(p => ({ ...p, dictionary: false, concordance: false }));
    }
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
                <Card onMouseUp={handleSelection} ref={contentRef}>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">{chapterContent.reference}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="prose prose-lg max-w-none font-body leading-relaxed [&_p]:mb-4"
                            dangerouslySetInnerHTML={{ __html: chapterContent.content }}
                        />
                    </CardContent>
                </Card>
            )}
            
            {selectionRect && (
                <div 
                    style={{
                        position: 'fixed',
                        top: `${selectionRect.top - 40}px`,
                        left: `${selectionRect.left + selectionRect.width / 2 - 20}px`,
                    }}
                >
                    <Button onClick={handleDefine} size="icon" className="rounded-full shadow-lg">
                        <BookOpen className="h-5 w-5" />
                    </Button>
                </div>
            )}
            
            <Dialog open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
                <DialogContent className="sm:max-w-md md:max-w-2xl max-h-[90vh]">
                     <DialogHeader>
                        <DialogTitle className="font-headline text-2xl">Diccionario y Concordancia</DialogTitle>
                        <DialogDescription>
                            Definición y versículos relacionados para <span className="font-bold">{dictionaryResult?.term}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="pr-4 -mr-4">
                      <div className="space-y-6 py-4">
                        <div>
                          <h3 className="text-lg font-headline font-bold mb-2">Definición</h3>
                          {isLoading.dictionary ? (
                              <div className="flex justify-center items-center h-24">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              </div>
                          ) : (
                              <div className="space-y-2 text-base">
                                  <p>{dictionaryResult?.definition}</p>
                                  {dictionaryResult?.reference && (
                                      <blockquote className="mt-4 border-l-2 pl-4 italic">
                                          {dictionaryResult.reference}
                                      </blockquote>
                                  )}
                              </div>
                          )}
                        </div>

                        <Separator />

                        <div>
                          <h3 className="text-lg font-headline font-bold mb-2">Concordancia</h3>
                          {isLoading.concordance ? (
                              <div className="flex justify-center items-center h-48">
                                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              </div>
                          ) : (
                            concordanceResult && concordanceResult.verses.length > 0 ? (
                              <div className="space-y-4">
                                {concordanceResult.verses.map((verse, index) => (
                                  <div key={index}>
                                    <h4 className="font-bold font-headline">{verse.reference}</h4>
                                    <p className="text-muted-foreground">{verse.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground italic">No se encontraron concordancias.</p>
                            )
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>


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

export function BibleReader() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <BibleReaderContent />
    </Suspense>
  )
}
