"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, CalendarCheck, Search, Columns, Settings } from "lucide-react";

export function NavDock() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/read", label: "Leer", icon: BookOpen },
    { href: "/plan", label: "Plan", icon: CalendarCheck },
    { href: "/search", label: "Buscar", icon: Search },
    { href: "/compare", label: "Comparar", icon: Columns },
  ];

  return (
    <nav
      aria-label="Navegación móvil"
      className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md bg-background/90 backdrop-blur-md border border-border/70 rounded-2xl shadow-xl px-2 py-1.5 flex items-center justify-around"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[11px] font-medium transition-all duration-200 ${
              isActive
                ? "text-primary font-bold bg-primary/10 scale-105"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Icon className={`h-5 w-5 mb-0.5 ${isActive ? "text-primary" : ""}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
