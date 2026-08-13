import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AcquisitieBriefHistorieKaart } from '@/components/acquisitie/AcquisitieBriefHistorieKaart';
import { AcquisitieWerkstroomBediening } from '@/components/acquisitie/AcquisitieWerkstroomBediening';
import VastgoedkansConceptbriefKaart from '@/components/acquisitie/VastgoedkansConceptbriefKaart';
import { useVastgoedkansBrieven } from '@/hooks/useAcquisitieBrieven';
import type { AcquisitieBrievenMetHistorieReadModel } from '@/lib/acquisitieBrievenAdapters';
import type { AcquisitieWerkstroomCommando } from '@/lib/acquisitieWerkstroomCommando';

interface AcquisitieBrievenStatusKaartProps {
  model: AcquisitieBrievenMetHistorieReadModel;
  titel?: string;
  commando?: AcquisitieWerkstroomCommando | null;
  onCommando?: (commando: AcquisitieWerkstroomCommando) => void | Promise<void>;
  commandoBezig?: boolean;
}

const jaNee = (waarde: boolean): string => (waarde ? 'Ja' : 'Nee');

export function AcquisitieBrievenStatusKaart({
  model,
  titel = 'Brieven & opvolging',
  commando = null,
  onCommando,
  commandoBezig = false,
}: AcquisitieBrievenStatusKaartProps) {
  const isVastgoedkans = model.dossier.bronType === 'vastgoedkans';
  const vastgoedkansBrieven = useVastgoedkansBrieven(isVastgoedkans ? model.dossier.bronId : null);
  const persistedBrieven = isVastgoedkans ? (vastgoedkansBrieven.data ?? []) : [];
  const heeftPersistedBrief = persistedBrieven.length > 0;
  const heeftPersistedVerstuurd = persistedBrieven.some((brief) => brief.status === 'verstuurd');
  const heeftPersistedGeadresseerde = persistedBrieven.some((brief) => Boolean(
    brief.eigenaar_naam?.trim() || brief.eigenaar_bedrijfsnaam?.trim() || brief.verzendadres?.trim(),
  ));

  const geadresseerdeAanwezig = model.geadresseerdeAanwezig || heeftPersistedGeadresseerde;
  const briefVoorbereid = model.briefVoorbereid || heeftPersistedBrief;
  const briefVerzonden = model.briefVerzonden || heeftPersistedVerstuurd;

  const faseLabel = isVastgoedkans && briefVerzonden && !model.reactieOntvangen
    ? 'Opvolgen'
    : isVastgoedkans && briefVoorbereid && !briefVerzonden
      ? 'Verzending registreren'
      : model.faseLabel;
  const primaireActie = isVastgoedkans && briefVerzonden && !model.reactieOntvangen
    ? 'Voer de geplande opvolging uit'
    : isVastgoedkans && briefVoorbereid && !briefVerzonden
      ? 'Genereer de PDF en registreer daarna de werkelijke verzending'
      : model.primaireActie;
  const toelichting = isVastgoedkans && briefVerzonden && !model.reactieOntvangen
    ? 'De verzending is vastgelegd. Gebruik de berekende opvolgdatum voor het volgende contactmoment.'
    : isVastgoedkans && briefVoorbereid && !briefVerzonden
      ? 'Het concept staat in het dossier. PDF-generatie is lokaal; markeren als verstuurd gebeurt alleen na expliciete bevestiging.'
      : model.toelichting;

  return (
    <div className="space-y-4">
      <Card data-testid="acquisitie-brieven-statuskaart">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{titel}</CardTitle>
            <Badge variant="outline">{faseLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{toelichting}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Volgende actie
            </p>
            <p className="mt-1 text-sm font-medium">{primaireActie}</p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">CRM-relatie gekoppeld</dt>
              <dd className="font-medium">{jaNee(model.relatieGekoppeld)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Geadresseerde gecontroleerd</dt>
              <dd className="font-medium">{jaNee(geadresseerdeAanwezig)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Brief voorbereid</dt>
              <dd className="font-medium">{jaNee(briefVoorbereid)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Brief verzonden</dt>
              <dd className="font-medium">{jaNee(briefVerzonden)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reactie geregistreerd</dt>
              <dd className="font-medium">{jaNee(model.reactieOntvangen)}</dd>
            </div>
          </dl>

          {commando && onCommando && (
            <AcquisitieWerkstroomBediening
              commando={commando}
              onUitvoeren={onCommando}
              bezig={commandoBezig}
            />
          )}

          <p className="text-xs text-muted-foreground">{model.veiligheidsmelding}</p>
        </CardContent>
      </Card>

      {isVastgoedkans && (
        <VastgoedkansConceptbriefKaart
          vastgoedkansId={model.dossier.bronId}
          adres={model.dossier.adres}
          plaats={model.dossier.plaats}
          eigenaarNaam={model.eigenaarNaam}
          enabled={model.eigenaarBekend && model.relatieGekoppeld}
        />
      )}

      <AcquisitieBriefHistorieKaart model={model.briefDossier} />
    </div>
  );
}
