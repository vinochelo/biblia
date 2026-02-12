"use client";

import { useState, useEffect } from 'react';

export const useStudyProgress = () => {
    const [completed, setCompleted] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const savedProgress = localStorage.getItem("study-progress");
        if (savedProgress) {
            try {
                const parsed = JSON.parse(savedProgress);
                if(Array.isArray(parsed)) {
                    setCompleted(new Set(parsed));
                }
            } catch {
                setCompleted(new Set());
            }
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
