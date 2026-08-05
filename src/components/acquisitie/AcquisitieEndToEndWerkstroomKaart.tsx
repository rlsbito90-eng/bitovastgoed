import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AcquisitieEndToEndReadModel } from '@/lib/acquisitieEndToEndWerkstroom';

export function AcquisitieEndToEndWerkstroomKaart({
  model,
  titel = 'Acquisitiewerkstroom',
}: {
  model: AcquisitieEndToEndReadModel;
  titel?: string;
}) {
  return (
    <Card data-testid="acquisitie-end-to-end-werkstroom">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{titel}</CardTitle>
          <Badge variant={model.geblokkeerd ? 'destructive' : 'outline'}>{model.faseLabel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{model.toelichting}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Voortgang</span>
            <span>{model.voortgang}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${model.voortgang}%` }} />
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Volgende bewuste actie</p>
          <p className="mt-1 text-sm font-medium">{model.primaireActie}</p>
        </div>

        <p className="text-xs text-muted-foreground">{model.veiligheidsmelding}</p>
      </CardContent>
    </Card>
  );
}
