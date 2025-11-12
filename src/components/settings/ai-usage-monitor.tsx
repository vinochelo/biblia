
"use client";

import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { RefreshCw } from "lucide-react";

const AI_API_USAGE_COUNT_KEY = "ai-api-usage-count";
const AI_API_USAGE_RESET_DATE_KEY = "ai-api-usage-reset-date";

const USAGE_LIMIT = 50; // A reasonable monthly limit for free tier audio generation

const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
}

export function AiUsageMonitor() {
  const [usage, setUsage] = useState({ used: 0, limit: USAGE_LIMIT, percentage: 0 });

  useEffect(() => {
    const checkAndResetCount = () => {
        const currentMonthKey = getCurrentMonthKey();
        const lastResetMonth = localStorage.getItem(AI_API_USAGE_RESET_DATE_KEY);

        if(currentMonthKey !== lastResetMonth) {
            localStorage.setItem(AI_API_USAGE_COUNT_KEY, "0");
            localStorage.setItem(AI_API_USAGE_RESET_DATE_KEY, currentMonthKey);
        }
    }

    const loadUsage = () => {
        checkAndResetCount();
        const storedUsage = localStorage.getItem(AI_API_USAGE_COUNT_KEY);
        const used = storedUsage ? parseInt(storedUsage, 10) : 0;
        const percentage = (used / USAGE_LIMIT) * 100;
        setUsage({ used, limit: USAGE_LIMIT, percentage });
    };

    loadUsage();

    // Listen for storage changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === AI_API_USAGE_COUNT_KEY) {
            loadUsage();
        }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  const resetCount = () => {
    localStorage.setItem(AI_API_USAGE_COUNT_KEY, "0");
    const currentMonthKey = getCurrentMonthKey();
    localStorage.setItem(AI_API_USAGE_RESET_DATE_KEY, currentMonthKey);
    setUsage({ used: 0, limit: USAGE_LIMIT, percentage: 0 });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-sm font-medium text-muted-foreground">Solicitudes de IA este mes</p>
          <p className="text-lg font-bold font-mono">
            {usage.used.toLocaleString('es')} / {usage.limit.toLocaleString('es')}
          </p>
        </div>
        <Progress value={usage.percentage} aria-label={`${Math.round(usage.percentage)}% usado`} />
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          El contador se reinicia automáticamente cada mes.
        </p>
        <Button variant="outline" size="sm" onClick={resetCount}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reiniciar
        </Button>
      </div>
    </div>
  );
}
