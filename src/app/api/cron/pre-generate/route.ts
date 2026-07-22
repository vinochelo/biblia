import { NextResponse } from 'next/server';
import { studyPlan } from '@/lib/study-plan';
import { getPassagesText } from '@/lib/actions';
import { textToSpeech } from '@/ai/flows/tts-flow';
import { bibleVersions } from '@/lib/data';
import { extractPlainTextFromBibleHtml } from '@/lib/utils';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Endpoint de Cron Job para pre-generar los audios de la lectura del día.
 * Se recomienda configurar en Vercel para que corra a las 00:00 UTC (o 05:00 local).
 */
export const maxDuration = 60; // 60 segundos de tiempo de ejecución permitido en Vercel

async function saveCronLog(logKey: string, logData: Record<string, any>) {
  if (!adminDb) {
    console.warn("Cron Log: adminDb no disponible para guardar logs en Firebase.");
    return;
  }
  try {
    await adminDb.ref(`cron_logs/${logKey}`).set(logData);
  } catch (e) {
    console.error("Cron Log: Error guardando log en Firebase:", e);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Consulta de logs guardados (?view=logs)
  if (searchParams.get('view') === 'logs') {
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin DB no disponible.' }, { status: 500 });
    }
    try {
      const snapshot = await adminDb.ref('cron_logs').orderByKey().limitToLast(20).get();
      const rawVal = snapshot.exists() ? snapshot.val() : {};
      // Transforma el objeto en arreglo ordenado por fecha descendente
      const logs = Object.entries(rawVal)
        .map(([id, val]: [string, any]) => ({ id, ...val }))
        .reverse();
      return NextResponse.json({ logs });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Error al obtener logs' }, { status: 500 });
    }
  }

  const authHeader = request.headers.get('authorization');
  
  // Seguridad: Verificar el CRON_SECRET de Vercel
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const startTime = Date.now();
  const timestampIso = new Date().toISOString();
  const logKey = timestampIso.replace(/[:.]/g, '-');
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  const runLog: Record<string, any> = {
    timestamp: timestampIso,
    date: `${day}/${month}`,
    status: 'running',
    versionResults: {},
    errors: [],
  };

  try {
    console.log(`Cron Job: Iniciando pre-generación para ${day}/${month}`);

    const reading = studyPlan.find(r => r.month === month && r.day === day);
    
    if (!reading) {
      runLog.status = 'no_reading';
      runLog.message = 'No hay lectura asignada para hoy.';
      runLog.durationMs = Date.now() - startTime;
      await saveCronLog(logKey, runLog);
      return NextResponse.json({ message: 'No hay lectura asignada para hoy.', log: runLog });
    }

    runLog.passages = reading.passages;

    const targetVersions = bibleVersions.filter(v => 
      ['RVR09', 'PDT', 'SSE', 'VBL'].includes(v.abbreviation)
    );

    console.log(`Cron Job: Iniciando pre-generación secuencial para ${targetVersions.length} versiones (${targetVersions.map(v => v.abbreviation).join(', ')})...`);

    let hasSuccess = false;
    let hasFailure = false;

    for (const version of targetVersions) {
      const versionStartTime = Date.now();
      try {
        console.log(`Cron Job: Procesando versión ${version.abbreviation}...`);
        const result = await getPassagesText(reading.passages, version.id);
        if (typeof result === 'string') {
          const plainText = extractPlainTextFromBibleHtml(result);

          if (plainText) {
            console.log(`Cron Job: Generando audio para versión ${version.abbreviation}...`);
            await textToSpeech({ text: plainText });
            console.log(`Cron Job: Éxito pre-generación versión ${version.abbreviation}.`);
            hasSuccess = true;
            runLog.versionResults[version.abbreviation] = {
              success: true,
              durationMs: Date.now() - versionStartTime,
            };
          } else {
            hasFailure = true;
            const msg = `Texto plano vacío extraído para ${version.abbreviation}`;
            runLog.versionResults[version.abbreviation] = {
              success: false,
              error: msg,
              durationMs: Date.now() - versionStartTime,
            };
            runLog.errors.push(`[${version.abbreviation}] ${msg}`);
          }
        }
      } catch (versionError: any) {
        hasFailure = true;
        const errorMsg = versionError.message || String(versionError);
        console.error(`Cron Job: Error en versión ${version.abbreviation}:`, errorMsg);
        runLog.versionResults[version.abbreviation] = {
          success: false,
          error: errorMsg,
          durationMs: Date.now() - versionStartTime,
        };
        runLog.errors.push(`[${version.abbreviation}] ${errorMsg}`);
      }
    }

    runLog.status = !hasFailure ? 'success' : (hasSuccess ? 'partial_success' : 'failed');
    runLog.durationMs = Date.now() - startTime;

    await saveCronLog(logKey, runLog);

    return NextResponse.json({ 
      success: !hasFailure, 
      status: runLog.status,
      date: `${day}/${month}`,
      passages: reading.passages,
      log: runLog
    });

  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error('Error en el Cron Job de pre-generación:', error);
    runLog.status = 'failed';
    runLog.error = errorMsg;
    runLog.durationMs = Date.now() - startTime;
    await saveCronLog(logKey, runLog);

    return NextResponse.json({ error: errorMsg, log: runLog }, { status: 500 });
  }
}
