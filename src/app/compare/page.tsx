import { VerseComparison } from "@/components/compare/verse-comparison";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function ComparePage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-2 text-center">
            <h1 className="text-3xl font-headline font-bold">Comparar Versiones</h1>
            <p className="text-muted-foreground">
                Busca un versículo y compáralo en diferentes traducciones de la Biblia.
            </p>
        </div>
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <VerseComparison />
        </Suspense>
      </div>
    </div>
  );
}
