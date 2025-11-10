"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { studyPlan } from "@/lib/study-plan";
import type { Reading } from "@/lib/study-plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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

function getFirstChapterFromPassage(passage: string): string {
    const bookMatch = passage.match(/^(\d? ?[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)/);
    if (!bookMatch) return '';
    
    let bookName = bookMatch[1].trim().replace(/\s/g, '');
    
    const bookId = bookToId[bookName];
    if (!bookId) return '';

    const chapterMatch = passage.match(/(\d+)/);
    if(!chapterMatch) return '';
    
    const chapterNumber = chapterMatch[1];

    return `${bookId}.${chapterNumber}`;
}

const useStudyProgress = () => {
    const [completed, setCompleted] = useState<Set<string>>(new Set());

    useEffect(() => {
        const savedProgress = localStorage.getItem("study-progress");
        if (savedProgress) {
            setCompleted(new Set(JSON.parse(savedProgress)));
        }
    }, []);

    const toggleComplete = (month: number, day: number) => {
        const key = `${month}-${day}`;
        setCompleted(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            localStorage.setItem("study-progress", JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const isCompleted = (month: number, day: number) => {
        return completed.has(`${month}-${day}`);
    };

    return { completed, toggleComplete, isCompleted };
};

export function StudyPlanReader() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { completed, toggleComplete, isCompleted } = useStudyProgress();

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(1); // Avoid issues with month-end dates
      newDate.setMonth(prev.getMonth() + offset);
      return newDate;
    });
  };

  const getReadingsForMonth = (month: number, year: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const readings = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const reading = studyPlan.find(r => r.month === month && r.day === day);
        readings.push({ day, reading: reading || null });
    }
    return readings;
  };

  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const monthReadings = getReadingsForMonth(currentMonth, currentYear);
  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(currentDate);

  const totalReadings = studyPlan.length;
  const completedReadings = completed.size;
  const progressPercentage = (completedReadings / totalReadings) * 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Progreso Anual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
            <Progress value={progressPercentage} aria-label={`${Math.round(progressPercentage)}% completado`} />
            <p className="text-sm text-center text-muted-foreground">{completedReadings} de {totalReadings} lecturas completadas.</p>
        </CardContent>
      </Card>
      
      <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
              <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold font-headline capitalize">{monthName}</h2>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
              <ArrowRight className="h-4 w-4" />
          </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {monthReadings.map(({day, reading}) => (
            <div key={day} className={`flex items-start gap-4 p-4 rounded-lg border ${isCompleted(currentMonth, day) ? 'bg-muted/50 text-muted-foreground' : 'bg-card'}`}>
                <div className="flex flex-col items-center">
                    <button onClick={() => reading && toggleComplete(currentMonth, day)} disabled={!reading} className="disabled:opacity-50 disabled:cursor-not-allowed">
                        {isCompleted(currentMonth, day) ? (
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : (
                            <Circle className="h-6 w-6 text-muted-foreground/50" />
                        )}
                    </button>
                    <span className="text-2xl font-bold">{day}</span>
                </div>
                <div className="flex-1">
                    {reading ? (
                        <div className={`grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3`}>
                             {reading.passages.map((passage, index) => {
                                const chapterId = getFirstChapterFromPassage(passage);
                                const link = chapterId ? `/read?chapter=${chapterId}` : '/read';
                                return (
                                    <Link href={link} key={index} className={`block group p-3 rounded-md transition-colors ${isCompleted(currentMonth, day) ? 'hover:bg-muted' : 'hover:bg-secondary'}`}>
                                        <div className="font-semibold font-headline text-lg">{passage}</div>
                                        <div className={`flex items-center text-sm ${isCompleted(currentMonth, day) ? 'text-muted-foreground' : 'text-primary group-hover:font-bold'}`}>
                                            Leer ahora <ArrowRight className="ml-2 h-4 w-4" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground italic mt-1">Día de descanso o lectura libre.</p>
                    )}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}