import Link from "next/link";
import {
  BookText,
  CalendarCheck,
  Search,
  Columns,
  Sparkles,
  ArrowRight,
  Headphones,
} from "lucide-react";
import { DailyReading } from "@/components/home/daily-reading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const maxDuration = 60;

export default function Home() {
  const appModules = [
    {
      href: "/read",
      title: "Leer la Biblia",
      description: "Explora cualquier libro y capítulo con narración en audio y diccionario interactivo.",
      icon: BookText,
      badge: "Audio Humano & IA",
      badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
      accent: "from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/40",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      href: "/plan",
      title: "Plan de Estudio Anual",
      description: "Lectura guiada de toda la Biblia en un año con seguimiento de progreso diario.",
      icon: CalendarCheck,
      badge: "365 Días",
      badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
      accent: "from-emerald-500/10 via-emerald-500/5 to-transparent hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      href: "/search",
      title: "Buscador Bíblico",
      description: "Busca palabras clave, temas y versículos en múltiples traducciones al instante.",
      icon: Search,
      badge: "Búsqueda Rápida",
      badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      accent: "from-blue-500/10 via-blue-500/5 to-transparent hover:border-blue-500/40",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      href: "/compare",
      title: "Comparar Versiones",
      description: "Contrasta versículos en paralelo entre RVR1960, NVI, TLA, LBLA y RVR1909.",
      icon: Columns,
      badge: "Estudio Paralelo",
      badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
      accent: "from-purple-500/10 via-purple-500/5 to-transparent hover:border-purple-500/40",
      iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-10">
      {/* ── Hero / Saludo de Bienvenida ── */}
      <section className="text-center space-y-3 max-w-3xl mx-auto pt-2 pb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Plataforma de Lectura y Devocional</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-headline font-bold tracking-tight text-foreground">
          Palabra Viva y Estudio Bíblico
        </h1>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          Accede a las Sagradas Escrituras en texto, escucha con locución humana e inteligencia artificial, y fortalece tu hábito devocional diario.
        </p>
      </section>

      {/* ── Grid de Módulos / Aplicaciones ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-headline font-bold text-foreground">
            Herramientas y Módulos
          </h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Selecciona una aplicación para comenzar
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {appModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.href} href={module.href} className="group block">
                <Card className={`h-full border border-border/60 transition-all duration-300 bg-gradient-to-br ${module.accent} hover:shadow-lg hover:-translate-y-1 rounded-2xl overflow-hidden`}>
                  <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={`h-11 w-11 rounded-xl ${module.iconBg} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${module.badgeColor}`}>
                          {module.badge}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="font-headline font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                          {module.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {module.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center text-xs font-semibold text-primary pt-2 group-hover:translate-x-1 transition-transform">
                      <span>Ingresar</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Sección de Lectura del Día ── */}
      <section className="space-y-6 pt-4 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <DailyReading />
        </div>
      </section>
    </div>
  );
}
