import { VerseComparison } from "@/components/compare/verse-comparison";

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
        <VerseComparison />
      </div>
    </div>
  );
}
