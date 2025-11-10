import { BibleReader } from "@/components/read/bible-reader";

export default function ReadPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
         <div className="space-y-2 text-center">
            <h1 className="text-3xl font-headline font-bold">Leer la Biblia</h1>
            <p className="text-muted-foreground">
                Selecciona un libro y un capítulo para comenzar tu lectura.
            </p>
        </div>
        <BibleReader />
      </div>
    </div>
  );
}
