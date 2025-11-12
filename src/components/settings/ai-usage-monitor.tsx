
"use client";

import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { RefreshCw } from "lucide-react";

type AiUsageType = 'tts' | 'dictionary';

const getStorageKeys = (type: AiUsageType) => ({
  countKey: `ai-api-usage-count-${type}`,
  resetDateKey: `ai-api-usage-reset-date-${type}`,
});

// Based on Gemini free tier, which is often around 15 RPM. A monthly limit is not strictly enforced by the free tier, so this is for general dev tracking.
const USAGE_LIMIT = 50;

const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
}

export function AiUsageMonitor({ type }: { type: AiUsageType }) {
  const { countKey, resetDateKey } = getStorageKeys(type);
  const [usage, setUsage] = useState({ used: 0, limit: USAGE_LIMIT, percentage: 0 });

  useEffect(() => {
    const checkAndResetCount = () => {
        const currentMonthKey = getCurrentMonthKey();
        const lastResetMonth = localStorage.getItem(resetDateKey);

        if(currentMonthKey !== lastResetMonth) {
            localStorage.setItem(countKey, "0");
            localStorage.setItem(resetDateKey, currentMonthKey);
        }
    }

    const loadUsage = () => {
        checkAndResetCount();
        const storedUsage = localStorage.getItem(countKey);
        const used = storedUsage ? parseInt(storedUsage, 10) : 0;
        const percentage = (used / USAGE_LIMIT) * 100;
        setUsage({ used, limit: USAGE_LIMIT, percentage });
    };

    loadUsage();

    // Listen for storage changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === countKey) {
            loadUsage();
        }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [countKey, resetDateKey]);
  
  const resetCount = () => {
    localStorage.setItem(countKey, "0");
    const currentMonthKey = getCurrentMonthKey();
    localStorage.setItem(resetDateKey, currentMonthKey);
    setUsage({ used: 0, limit: USAGE_LIMIT, percentage: 0 });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-sm font-medium text-muted-foreground">Solicitudes este mes</p>
          <p className="text-lg font-bold font-mono">
            {usage.used.toLocaleString('es')} / {usage.limit.toLocaleString('es')}
          </p>
        </div>
        <Progress value={usage.percentage} aria-label={`${Math.round(usage.percentage)}% usado`} />
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          El contador se reinicia automáticamente cada mes. El límite real de la capa gratuita suele ser por minuto (ej. 15 RPM).
        </p>
        <Button variant="outline" size="sm" onClick={resetCount}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reiniciar
        </Button>
      </div>
    </div>
  );
}
