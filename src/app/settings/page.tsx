import { UsageMonitor } from '@/components/settings/usage-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-headline font-bold">Configuración</h1>
            <p className="text-muted-foreground">
                Monitorea el consumo de la API.
            </p>
        </div>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Información de la Clave API</AlertTitle>
          <AlertDescription>
            La clave API para producción se gestiona de forma segura en el servidor a través de variables de entorno. Ya no es necesario configurarla aquí.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Monitoreo de Uso</CardTitle>
            <CardDescription>
                Realiza un seguimiento de tu uso de la API en este navegador para mantenerte dentro de los límites.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsageMonitor />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
