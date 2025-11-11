import Link from 'next/link';
import { BookOpen, Settings, BookText, CalendarCheck, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-lg font-headline">Explorador de Versículos</span>
        </Link>
        <nav className="ml-auto flex items-center gap-2">
           <Button variant="ghost" size="icon" asChild>
            <Link href="/plan" aria-label="Plan de Estudio">
              <CalendarCheck className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/read" aria-label="Leer la Biblia">
              <BookText className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/compare" aria-label="Comparar Versiones">
              <Columns className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings" aria-label="Configuración">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
