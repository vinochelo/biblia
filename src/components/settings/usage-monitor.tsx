"use client";

import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from 'react';

const MOCK_USAGE_DATA = {
  starter: {
    used: 1234,
    limit: 5000,
  },
  pro: {
    used: 87654,
    limit: 150000,
  },
};

export function UsageMonitor() {
  const [usage, setUsage] = useState({ used: 0, limit: 5000, percentage: 0 });

  useEffect(() => {
    // Esto es un dato simulado. En una aplicación real, obtendrías estos datos de tu API.
    const plan = 'starter'; 
    const data = MOCK_USAGE_DATA[plan];
    const percentage = (data.used / data.limit) * 100;
    setUsage({ ...data, percentage });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-sm font-medium text-muted-foreground">Llamadas a la API este mes</p>
          <p className="text-lg font-bold font-mono">
            {usage.used.toLocaleString('es')} / {usage.limit.toLocaleString('es')}
          </p>
        </div>
        <Progress value={usage.percentage} aria-label={`${Math.round(usage.percentage)}% usado`} />
      </div>
      <p className="text-xs text-muted-foreground">
        El uso de tu API se reinicia al comienzo de cada ciclo de facturación mensual.
      </p>
    </div>
  );
}
