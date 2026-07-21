import { NextResponse } from 'next/server';
import { studyPlan } from '@/lib/study-plan';
import { getPassagesText } from '@/lib/actions';
import { textToSpeech } from '@/ai/flows/tts-flow';
import { bibleVersions } from '@/lib/data';

/**
 * Endpoint de Cron Job para pre-generar los audios de la lectura del día.
 * Se recomienda configurar en Vercel para que corra a las 00:00 UTC.
 */
export const maxDuration = 60; // 60 segundos de tiempo de ejecución permitido en Vercel

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  // Seguridad: Verificar el CRON_SECRET de Vercel
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const today = new Date();
    const month = today.getUTCMonth() + 1;
    const day = today.getUTCDate();
    
    console.log(`Cron Job: Iniciando pre-generación para ${day}/${month}`);

    const reading = studyPlan.find(r => r.month === month && r.day === day);
    
    if (!reading) {
      return NextResponse.json({ message: 'No hay lectura asignada para hoy.' });
    }

    // Pre-generar secuencialmente para evitar sobrecargar la cuota de la API de Gemini (429 Rate Limit)
    const targetVersions = bibleVersions.filter(v => 
      ['RVR09', 'PDT', 'SSE', 'VBL'].includes(v.abbreviation)
    );

    console.log(`Cron Job: Iniciando pre-generación secuencial para ${targetVersions.length} versiones (${targetVersions.map(v => v.abbreviation).join(', ')})...`);

    const results: Record<string, boolean> = {};

    for (const version of targetVersions) {
      try {
        console.log(`Cron Job: Procesando versión ${version.abbreviation}...`);
        const result = await getPassagesText(reading.passages, version.id);
        if (typeof result === 'string') {
          const plainText = result
            .replace(/<span[^>]*class="v"[^>]*>.*?<\/span>/g, '')
            .replace(/<h3>/g, '\n\n')
            .replace(/<\/h3>/g, '\n')
            .replace(/<[^>]*>?/gm, '')
            .trim();

          if (plainText) {
            console.log(`Cron Job: Generando audio para versión ${version.abbreviation}...`);
            await textToSpeech({ text: plainText });
            console.log(`Cron Job: Éxito pre-generación versión ${version.abbreviation}.`);
            results[version.abbreviation] = true;
          }
        }
      } catch (versionError: any) {
        console.error(`Cron Job: Error en versión ${version.abbreviation}:`, versionError.message || versionError);
        results[version.abbreviation] = false;
      }
    }

    return NextResponse.json({ 
      success: true, 
      date: `${day}/${month}`,
      passages: reading.passages 
    });

  } catch (error: any) {
    console.error('Error en el Cron Job de pre-generación:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
