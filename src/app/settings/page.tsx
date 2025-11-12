
import { UsageMonitor } from '@/components/settings/usage-monitor';
import { AiUsageMonitor } from '@/components/settings/ai-usage-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-headline font-bold">Configuración y Uso</h1>
            <p className="text-muted-foreground">
                Monitorea el consumo de las APIs para desarrollo.
            </p>
        </div>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Información sobre los Límites</AlertTitle>
          <AlertDescription>
            La clave API para producción se gestiona de forma segura en el servidor. Los contadores de uso aquí son una herramienta de desarrollo y se basan en los límites conocidos de las capas gratuitas (ej. 15 solicitudes por minuto para la IA de Google o 5,000 al mes para api.bible). Los límites reales pueden variar según tu plan.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Uso de la API de la Biblia</CardTitle>
            <CardDescription>
                Seguimiento de tu uso de la API de `rest.api.bible` (Plan Starter: ~5,000/mes).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsageMonitor />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso de IA (Texto a Voz)</CardTitle>
            <CardDescription>
                Seguimiento del uso de la API de IA para la generación de audio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiUsageMonitor type="tts" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso de IA (Diccionario/Concordancia)</CardTitle>
            <CardDescription>
                Seguimiento del uso de la API de IA para definiciones y concordancias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AiUsageMonitor type="dictionary" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
