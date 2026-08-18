"use client";

import React from "react";
import { Type } from "lucide-react";

export type FontSize = "sm" | "md" | "lg" | "xl";

export const FONT_CONFIG: Record<FontSize, { fontSize: string; lineHeight: string; label: string; tooltip: string }> = {
  sm: {
    fontSize: "1.05rem",
    lineHeight: "1.7",
    label: "A",
    tooltip: "Letra Compacta (16px)",
  },
  md: {
    fontSize: "1.25rem",
    lineHeight: "1.85",
    label: "A+",
    tooltip: "Letra Normal (20px)",
  },
  lg: {
    fontSize: "1.55rem",
    lineHeight: "2.05",
    label: "A++",
    tooltip: "Letra Grande (25px)",
  },
  xl: {
    fontSize: "1.95rem",
    lineHeight: "2.3",
    label: "A+++",
    tooltip: "Letra Extra Grande (31px)",
  },
};

export const FONT_SIZE_OPTIONS: { id: FontSize; label: string; tooltip: string }[] = [
  { id: "sm", label: FONT_CONFIG.sm.label, tooltip: FONT_CONFIG.sm.tooltip },
  { id: "md", label: FONT_CONFIG.md.label, tooltip: FONT_CONFIG.md.tooltip },
  { id: "lg", label: FONT_CONFIG.lg.label, tooltip: FONT_CONFIG.lg.tooltip },
  { id: "xl", label: FONT_CONFIG.xl.label, tooltip: FONT_CONFIG.xl.tooltip },
];

interface FontSizeControlProps {
  fontSize: FontSize;
  onChange: (size: FontSize) => void;
  className?: string;
}

export function FontSizeControl({ fontSize, onChange, className = "" }: FontSizeControlProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 bg-muted/70 p-1 rounded-xl border border-border/50 shadow-xs ${className}`}
      role="group"
      aria-label="Ajuste de tamaño de letra"
    >
      <span className="text-[11px] font-medium text-muted-foreground px-1.5 flex items-center gap-1 select-none">
        <Type className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">Texto:</span>
      </span>

      {FONT_SIZE_OPTIONS.map((opt) => {
        const isSelected = fontSize === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            title={opt.tooltip}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
              isSelected
                ? "bg-background text-foreground shadow-xs scale-105 font-bold text-primary border border-border/40"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
