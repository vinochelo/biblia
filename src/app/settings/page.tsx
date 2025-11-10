import { SettingsForm } from '@/components/settings/settings-form';
import { UsageMonitor } from '@/components/settings/usage-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-headline font-bold">Configuración</h1>
            <p className="text-muted-foreground">
                Gestiona tu clave API, plan de uso y monitorea tu consumo.
            </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Clave API y Plan</CardTitle>
            <CardDescription>
                Configura tu clave de API.Bible y selecciona tu plan de uso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoreo de Uso</CardTitle>
            <CardDescription>
                Realiza un seguimiento de tu uso de la API para mantenerte dentro de los límites.
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
