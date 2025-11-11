
"use client";

import { searchVerses } from "@/lib/actions";
import { bibleVersions } from "@/lib/data";
import type { SearchResult } from "@/lib/types";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchResults } from "./search-results";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { trackApiCall } from "@/lib/utils";

export function VerseSearch() {
  const [version, setVersion] = useState(bibleVersions.find(v => v.abbreviation === 'RV1909')?.id || bibleVersions[0].id);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    const key = localStorage.getItem("bible-api-key") || "hHfw2xKKsVSS1wuy9nGe7";
    setApiKey(key);
  }, []);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = formData.get("query") as string;

    if (!apiKey) {
      setError("Por favor, configura tu clave API en la página de configuración.");
      setResults(null);
      setHasSearched(true);
      return;
    }

    if (!query) {
      setError("Por favor, introduce un término de búsqueda.");
      setResults(null);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setResults(null);
    
    trackApiCall();
    const response = await searchVerses(query, version, apiKey);
    if ("error" in response) {
      setError(response.error);
    } else {
      setResults(response);
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-2 text-primary">
          Tu Guía Bíblica
        </h1>
        <p className="text-lg text-muted-foreground">
          Busca versículos, explora pasajes y profundiza en las Escrituras.
        </p>
      </div>
      
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="query"
            type="search"
            placeholder="Ej: Génesis 1:1 o 'amor'"
            className="pl-10 h-12 text-base"
          />
        </div>
        <Select value={version} onValueChange={setVersion}>
          <SelectTrigger className="w-full sm:w-[220px] h-12">
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
        <Button type="submit" className="h-12" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4 sm:hidden" />
          )}
          Buscar
        </Button>
      </form>

      <div className="min-h-[300px]">
        {isLoading && (
          <div className="flex justify-center items-center h-full pt-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        {results && <SearchResults results={results} />}
        {!isLoading && !results && hasSearched && !error && (
          <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
            <p className="text-muted-foreground">No se encontraron resultados. Intenta con otra búsqueda.</p>
          </div>
        )}
        {!isLoading && !hasSearched && (
           <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
             <p className="text-muted-foreground">Los resultados de tu búsqueda aparecerán aquí.</p>
           </div>
        )}
      </div>
    </div>
  );
}
