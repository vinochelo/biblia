import { BibleReader } from "@/components/read/bible-reader";
import { Suspense } from "react";
import { Loader2, BookOpen } from "lucide-react";

export default function ReadPage() {
  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Lectura Bíblica</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold tracking-tight">
            Leer las Sagradas Escrituras
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Explora capítulos completos, escucha con locución humana o IA, y ajusta el tamaño del texto a tu gusto.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <BibleReader />
        </Suspense>
      </div>
    </div>
  );
}

