import Link from 'next/link';
import { BookOpen, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-lg font-headline">Explorador de Versículos</span>
        </Link>
        <nav className="ml-auto">
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
