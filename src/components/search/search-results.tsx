
import type { SearchResult } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bibleVersions } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

interface SearchResultsProps {
  results: SearchResult;
}

export function SearchResults({ results }: SearchResultsProps) {
  const version = bibleVersions.find(v => v.id === results.bibleId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-semibold">Resultados</h2>
        <div className="text-sm text-muted-foreground">
          <span className="font-bold">{results.total}</span> versículos encontrados en <Badge variant="secondary">{version?.abbreviation}</Badge>
        </div>
      </div>
      
      <div className="space-y-4">
        {results.verses.map((verse) => (
          <Card key={verse.id}>
            <CardHeader>
              <CardTitle className="font-headline text-xl">{verse.reference}</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="leading-relaxed text-lg font-body"
                dangerouslySetInnerHTML={{ __html: verse.text.replace(/<b/g, '<strong').replace(/<\/b>/g, '</strong>') }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
