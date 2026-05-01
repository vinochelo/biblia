import { NextResponse } from 'next/server';
import { studyPlan } from '@/lib/study-plan';
import { getPassagesText } from '@/lib/actions';
import { textToSpeech } from '@/ai/flows/tts-flow';
import { bibleVersions } from '@/lib/data';

/**
 * Endpoint de Cron Job para pre-generar los audios de la lectura del día.
 * Se recomienda configurar en Vercel para que corra a las 00:00 UTC.
 */
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

    // Por ahora pre-generamos la versión por defecto (RVR09)
    const defaultVersion = bibleVersions.find(v => v.abbreviation === 'RVR09')?.id || bibleVersions[0].id;
    
    const result = await getPassagesText(reading.passages, defaultVersion);
    
    if (typeof result === 'string') {
      // Limpiar HTML para convertirlo en texto plano para el TTS
      const plainText = result
        .replace(/<h3>/g, '\n\n')
        .replace(/<\/h3>/g, '\n')
        .replace(/<[^>]*>?/gm, '') // Eliminar el resto de etiquetas HTML
        .trim();

      if (plainText) {
        console.log(`Cron Job: Generando audio para "${reading.passages.join(', ')}"...`);
        // La función textToSpeech ya tiene la lógica de cachear en Firebase
        await textToSpeech({ text: plainText });
        console.log(`Cron Job: Pre-generación completada con éxito.`);
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
