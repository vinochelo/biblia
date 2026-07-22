"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CronLogEntry {
  id: string;
  timestamp: string;
  date?: string;
  status: 'success' | 'partial_success' | 'failed' | 'no_reading' | 'running';
  versionResults?: Record<string, { success: boolean; error?: string; durationMs?: number }>;
  errors?: string[];
  durationMs?: number;
  message?: string;
}

export function CronLogViewer() {
  const [logs, setLogs] = useState<CronLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/pre-generate?view=logs");
      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      } else {
        setLogs([]);
      }
    } catch (e: any) {
      setError(e.message || "Error al cargar el historial de ejecución");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const renderStatusBadge = (status: CronLogEntry['status']) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Exitoso
          </Badge>
        );
      case 'partial_success':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
            <AlertTriangle className="w-3 h-3" /> Parcial
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1">
            <XCircle className="w-3 h-3" /> Fallido
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" /> {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Historial de ejecuciones automáticas de las 05:00 AM (00:00 UTC).
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={isLoading}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-md border border-rose-200 dark:border-rose-900">
          {error}
        </div>
      )}

      {!isLoading && logs.length === 0 && !error && (
        <div className="text-center py-6 text-xs text-muted-foreground bg-muted/40 rounded-lg border border-dashed">
          Aún no hay ejecuciones registradas. Se registrará la primera corrida automática a las 00:00 UTC.
        </div>
      )}

      <div className="space-y-3">
        {logs.map((log) => {
          const dateFormatted = new Date(log.timestamp).toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={log.id}
              className="p-3 text-sm rounded-lg border bg-card/60 backdrop-blur-sm space-y-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{dateFormatted}</span>
                  {log.date && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-secondary">
                      Lectura {log.date}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {log.durationMs && (
                    <span className="text-[11px] text-muted-foreground">
                      {(log.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {renderStatusBadge(log.status)}
                </div>
              </div>

              {log.versionResults && Object.keys(log.versionResults).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(log.versionResults).map(([ver, res]) => (
                    <span
                      key={ver}
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                        res.success
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                      }`}
                    >
                      {ver}: {res.success ? "OK" : "Error"}
                    </span>
                  ))}
                </div>
              )}

              {log.errors && log.errors.length > 0 && (
                <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-700 dark:text-rose-300 space-y-1 font-mono">
                  {log.errors.map((err, idx) => (
                    <div key={idx}>⚠️ {err}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
