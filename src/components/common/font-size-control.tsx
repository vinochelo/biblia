"use client";

import React from "react";
import { Type } from "lucide-react";

export type FontSize = "sm" | "md" | "lg" | "xl";

interface FontSizeControlProps {
  fontSize: FontSize;
  onChange: (size: FontSize) => void;
  className?: string;
}

export const FONT_SIZE_OPTIONS: { id: FontSize; label: string; tooltip: string }[] = [
  { id: "sm", label: "A", tooltip: "Letra Compacta (15px)" },
  { id: "md", label: "A+", tooltip: "Letra Normal (18px)" },
  { id: "lg", label: "A++", tooltip: "Letra Grande (21px)" },
  { id: "xl", label: "A+++", tooltip: "Letra Extra Grande (24px)" },
];

export function FontSizeControl({ fontSize, onChange, className = "" }: FontSizeControlProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 shadow-xs ${className}`}
      role="group"
      aria-label="Ajuste de tamaño de letra"
    >
      <span className="text-[11px] font-medium text-muted-foreground px-1.5 flex items-center gap-1 select-none">
        <Type className="h-3.5 w-3.5" />
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
                ? "bg-background text-foreground shadow-xs scale-105 font-bold text-primary"
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
