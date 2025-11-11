"use client";

import { useState, useEffect } from "react";
import { searchVerses, getVerse } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { Verse, BibleVersion } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Terminal } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { trackApiCall } from "@/lib/utils";

export function VerseComparison() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [query, setQuery] = useState("Juan 3:16");
  const [verseId, setVerseId] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([
    "592420522e16049f-01", // RV1909
    "6b7f504f1b6050c1-01", // NBV
    "482ddd53705278cc-02", // VBL
  ]);
  const [comparisonResults, setComparisonResults] = useState<
    { version: BibleVersion; verse: Verse | { error: string } }[]
  >([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = localStorage.getItem("bible-api-key") || "hHfw2xKKsVSS1wuy9nGe7";
    setApiKey(key);
  }, []);

  const handleVersionToggle = (versionId: string) => {
    setSelectedVersions((prev) =>
      prev.includes(versionId)
        ? prev.filter((id) => id !== versionId)
        : [...prev, versionId]
    );
  };
  
  const findVerseId = async (searchQuery: string): Promise<string | null> => {
     if (!apiKey) return null;
     // Use a common version to find the verse ID
     const searchVersion = bibleVersions[0].id;
     trackApiCall(); // For the search
     const response = await searchVerses(searchQuery, searchVersion, apiKey);
     if ("error" in response) {
         setError(response.error);
         return null;
     }
     if (response.verses.length > 0) {
        // Find the verse that is an exact match for the query
        const exactMatch = response.verses.find(v => v.reference.toLowerCase() === searchQuery.toLowerCase());
        if (exactMatch) {
            setReference(exactMatch.reference);
            return exactMatch.id;
        }
        // Fallback to the first result
        setReference(response.verses[0].reference);
        return response.verses[0].id;
     }
     setError("No se encontró el versículo. Intenta con una referencia más específica (ej. 'Juan 3:16').");
     return null;
  }

  const handleCompare = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    if (!apiKey) {
      setError("Por favor, configura tu clave API en la página de configuración.");
      return;
    }
    if (!query) {
      setError("Por favor, introduce una referencia de versículo.");
      return;
    }
    if (selectedVersions.length === 0) {
      setError("Por favor, selecciona al menos una versión para comparar.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setComparisonResults([]);

    const foundVerseId = await findVerseId(query);
    if (!foundVerseId) {
        setIsLoading(false);
        return;
    }
    setVerseId(foundVerseId);

    const results = await Promise.all(
      selectedVersions.map(async (versionId) => {
        const version = bibleVersions.find((v) => v.id === versionId)!;
        trackApiCall(); // For each version compared
        const verse = await getVerse(versionId, foundVerseId, apiKey);
        return { version, verse };
      })
    );
    
    setComparisonResults(results);
    setIsLoading(false);
  };
  
   useEffect(() => {
    handleCompare();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-6">
            <form onSubmit={handleCompare} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="verse-query" className="font-bold">Referencia del Versículo</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="verse-query"
                            name="query"
                            type="search"
                            placeholder="Ej: Juan 3:16"
                            className="pl-10 h-11 text-base"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
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
            {isLoading && (
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
            
            {!isLoading && !error && comparisonResults.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold font-headline text-center">{reference || query}</h2>
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
            {!isLoading && !error && comparisonResults.length === 0 && (
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
