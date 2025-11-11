
import { AudioBiblePlayer } from "@/components/audio/audio-bible-player";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function AudioPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
         <div className="space-y-2 text-center">
            <h1 className="text-3xl font-headline font-bold">Audiobiblia</h1>
            <p className="text-muted-foreground">
                Escucha las Escrituras. Selecciona un libro y un capítulo para comenzar.
            </p>
        </div>
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <AudioBiblePlayer />
        </Suspense>
      </div>
    </div>
  );
}
