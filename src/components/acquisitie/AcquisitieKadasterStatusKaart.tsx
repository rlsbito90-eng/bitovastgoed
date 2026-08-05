import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AcquisitieKadasterReadModel } from '@/lib/acquisitieKadasterReadModel';

interface AcquisitieKadasterStatusKaartProps {
  model: AcquisitieKadasterReadModel;
  titel?: string;
}

const jaNee = (waarde: boolean): string => (waarde ? 'Ja' : 'Nee');

export function AcquisitieKadasterStatusKaart({
  model,
  titel = 'Kadaster & eigenaar',
}: AcquisitieKadasterStatusKaartProps) {
  return (
    <Card data-testid="acquisitie-kadaster-statuskaart">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{titel}</CardTitle>
          <Badge variant="outline">{model.faseLabel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{model.toelichting}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Volgende actie
          </p>
          <p className="mt-1 text-sm font-medium">{model.primaireActie}</p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Adres gecontroleerd</dt>
            <dd className="font-medium">{jaNee(model.adresControleGeslaagd)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">BAG-context aanwezig</dt>
            <dd className="font-medium">{jaNee(model.bagContextAanwezig)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kadasteronderzoek vastgelegd</dt>
            <dd className="font-medium">{jaNee(model.kadasterOnderzoekAanwezig)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Eigenaar bekend</dt>
            <dd className="font-medium">{jaNee(model.eigenaarBekend)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">CRM-relatie gekoppeld</dt>
            <dd className="font-medium">{jaNee(model.eigenaarRelatieGekoppeld)}</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">{model.veiligheidsmelding}</p>
      </CardContent>
    </Card>
  );
}
