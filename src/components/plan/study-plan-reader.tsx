"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { studyPlan } from "@/lib/study-plan";
import type { Reading } from "@/lib/study-plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const bookToId: { [key: string]: string } = {
    "Génesis": "GEN", "Éxodo": "EXO", "Levítico": "LEV", "Números": "NUM", "Deuteronomio": "DEU",
    "Josué": "JOS", "Jueces": "JDG", "Rut": "RUT", "1Samuel": "1SA", "2Samuel": "2SA",
    "1Reyes": "1KI", "2Reyes": "2KI", "1Crónicas": "1CH", "2Crónicas": "2CH", "Esdras": "EZR",
    "Nehemías": "NEH", "Ester": "EST", "Job": "JOB", "Salmos": "PSA", "Proverbios": "PRO",
    "Eclesiastés": "ECC", "Cantares": "SNG", "Isaías": "ISA", "Jeremías": "JER",
    "Lamentaciones": "LAM", "Ezequiel": "EZK", "Daniel": "DAN", "Oseas": "HOS", "Joel": "JOL",
    "Amós": "AMO", "Abdías": "OBA", "Jonás": "JON", "Miqueas": "MIC", "Nahum": "NAM",
    "Habacuc": "HAB", "Sofonías": "ZEP", "Hageo": "HAG", "Zacarías": "ZEC", "Malaquías": "MAL",
    "Mateo": "MAT", "Marcos": "MRK", "Lucas": "LUK", "Juan": "JHN", "Hechos": "ACT",
    "Romanos": "ROM", "1Corintios": "1CO", "2Corintios": "2CO", "Gálatas": "GAL", "Efesios": "EPH",
    "Filipenses": "PHP", "Colosenses": "COL", "1Tesalonicenses": "1TH", "2Tesalonicenses": "2TH",
    "1Timoteo": "1TI", "2Timoteo": "2TI", "Tito": "TIT", "Filemón": "PHM", "Hebreos": "HEB",
    "Santiago": "JAS", "1Pedro": "1PE", "2Pedro": "2PE", "1Juan": "1JN", "2Juan": "2JN",
    "3Juan": "3JN", "Judas": "JUD", "Apocalipsis": "REV"
  };

  function getFormattedDate(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }
  
  function getFirstChapterFromPassage(passage: string): string {
    const bookMatch = passage.match(/^(\d? ?[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)/);
    if (!bookMatch) return '';
    
    let bookName = bookMatch[1].trim();
    // Special handling for numbered books like "1 Corintios"
    bookName = bookName.replace(/\s/g, '');
    
    const bookId = bookToId[bookName];
    if (!bookId) return '';

    const chapterMatch = passage.match(/(\d+)/);
    if(!chapterMatch) return '';
    
    const chapterNumber = chapterMatch[1];

    return `${bookId}.${chapterNumber}`;
  }


export function StudyPlanReader() {
  const [todayReading, setTodayReading] = useState<Reading | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now);
    const todayMonth = now.getMonth() + 1; // getMonth() es 0-indexed
    const todayDay = now.getDate();

    const reading = studyPlan.find(
      (r) => r.month === todayMonth && r.day === todayDay
    );
    setTodayReading(reading || null);
  }, []);

  if (!currentDate) {
    return null; // O un spinner/loading
  }

  return (
    <div className="space-y-6">
       <Card className="text-center bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle className="text-2xl font-bold font-headline">
            Lectura para hoy: {getFormattedDate(currentDate)}
          </CardTitle>
        </CardHeader>
      </Card>
      
      {todayReading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {todayReading.passages.map((passage, index) => {
            const chapterId = getFirstChapterFromPassage(passage);
            const link = chapterId ? `/read?chapter=${chapterId}` : '/read';

            return (
                <Link href={link} key={index} className="block group">
                    <Card className="h-full transition-all duration-200 ease-in-out group-hover:shadow-lg group-hover:border-primary">
                        <CardHeader>
                        <CardTitle className="font-headline text-2xl">{passage}</CardTitle>
                        </CardHeader>
                        <CardContent>
                        <div className="flex items-center justify-end text-sm text-primary group-hover:font-bold">
                            Leer ahora <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                        </CardContent>
                    </Card>
                </Link>
            );
          })}
        </div>
      ) : (
        <Card>
            <CardHeader>
                <CardTitle>No hay lectura para hoy</CardTitle>
            </CardHeader>
            <CardContent>
                <p>No se encontró un plan de lectura para el día de hoy.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
