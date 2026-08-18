"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BookText,
  CalendarCheck,
  Search,
  Columns,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/read", label: "Leer la Biblia", icon: BookText },
    { href: "/plan", label: "Plan de Estudio", icon: CalendarCheck },
    { href: "/search", label: "Buscador", icon: Search },
    { href: "/compare", label: "Comparar", icon: Columns },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 shadow-sm transition-all">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group transition-transform hover:scale-[1.02]"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base md:text-lg font-headline font-bold tracking-tight leading-tight">
              Explorador Bíblico
            </span>
            <span className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider hidden sm:block">
              Lectura • Audio • Estudio
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/40">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-background text-foreground shadow-sm font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-9 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl border border-transparent hover:border-border/60 hover:bg-muted/50 transition-all"
          >
            <Link href="/settings" aria-label="Configuración y Estado">
              <Settings className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Ajustes</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
