import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AcquisitieEndToEndReadModel } from '@/lib/acquisitieEndToEndWerkstroom';
import {
  bepaalAcquisitieWerkstroomCommando,
  type AcquisitieWerkstroomCommando,
} from '@/lib/acquisitieWerkstroomCommando';

export function AcquisitieWerkstroomBediening({
  model,
  bezig = false,
  onCommando,
}: {
  model: AcquisitieEndToEndReadModel;
  bezig?: boolean;
  onCommando: (commando: AcquisitieWerkstroomCommando) => void;
}) {
  const commando = bepaalAcquisitieWerkstroomCommando(model);

  return (
    <Card data-testid="acquisitie-werkstroom-bediening">
      <CardHeader>
        <CardTitle className="text-base">Volgende actie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">{commando.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{commando.toelichting}</p>
        </div>

        <Button
          type="button"
          disabled={!commando.toegestaan || bezig}
          onClick={() => onCommando(commando)}
          data-testid={`acquisitie-commando-${commando.type}`}
        >
          {bezig ? 'Bezig…' : commando.label}
        </Button>

        {commando.vereistBevestiging && (
          <p className="text-xs text-muted-foreground">
            Deze stap vereist een expliciete gebruikersbevestiging en voert geen vervolgactie automatisch uit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
