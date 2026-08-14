import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AcquisitieBriefHistorieKaart } from '@/components/acquisitie/AcquisitieBriefHistorieKaart';
import { AcquisitieWerkstroomBediening } from '@/components/acquisitie/AcquisitieWerkstroomBediening';
import VastgoedkansConceptbriefKaart, { type BriefEigenaarOptie } from '@/components/acquisitie/VastgoedkansConceptbriefKaart';
import { useRegistreerVastgoedkansBriefRespons, useVastgoedkansBrieven } from '@/hooks/useAcquisitieBrieven';
import { useVastgoedkansEigenaren } from '@/hooks/useVastgoedkansEigenaren';
import { RESPONS_LABEL, RESPONS_VOLGORDE, type Responsstatus } from '@/lib/offMarket/brieven/respons';
import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';
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
const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function AcquisitieBrievenStatusKaart({
  model,
  titel = 'Brieven & opvolging',
  commando = null,
  onCommando,
  commandoBezig = false,
}: AcquisitieBrievenStatusKaartProps) {
  const isVastgoedkans = model.dossier.bronType === 'vastgoedkans';
  const vastgoedkansId = isVastgoedkans ? model.dossier.bronId : null;
  const vastgoedkansBrieven = useVastgoedkansBrieven(vastgoedkansId);
  const eigenarenQuery = useVastgoedkansEigenaren(vastgoedkansId);
  const registreerRespons = useRegistreerVastgoedkansBriefRespons();
  const persistedBrieven = isVastgoedkans ? (vastgoedkansBrieven.data ?? []) : [];
  const verstuurdeBrief = persistedBrieven.find((brief) => brief.status === 'verstuurd') ?? null;
  const heeftPersistedBrief = persistedBrieven.length > 0;
  const heeftPersistedVerstuurd = Boolean(verstuurdeBrief);
  const heeftPersistedRespons = Boolean(verstuurdeBrief?.responsstatus);
  const heeftPersistedGeadresseerde = persistedBrieven.some((brief) => Boolean(
    brief.eigenaar_naam?.trim() || brief.eigenaar_bedrijfsnaam?.trim() || brief.verzendadres?.trim(),
  ));
  const eigenaarOpties = useMemo<BriefEigenaarOptie[]>(() => (eigenarenQuery.data ?? [])
    .filter((koppeling) => Boolean(koppeling.eigenaar) && !koppeling.eigenaar?.archived_at)
    .map((koppeling) => ({
      id: koppeling.eigenaar!.id,
      partijType: koppeling.eigenaar!.partij_type,
      naam: koppeling.eigenaar!.naam,
      bedrijfsnaam: koppeling.eigenaar!.bedrijfsnaam,
      adres: koppeling.eigenaar!.adres,
      postcode: koppeling.eigenaar!.postcode,
      plaats: koppeling.eigenaar!.plaats,
      crmRelatieId: koppeling.eigenaar!.crm_relatie_id,
    })), [eigenarenQuery.data]);
  const eigenaarInRegister = eigenaarOpties.length > 0;

  const [responsstatus, setResponsstatus] = useState<Responsstatus>('reactie_ontvangen');
  const [responsdatum, setResponsdatum] = useState(new Date().toISOString().slice(0, 10));
  const [responsKanaal, setResponsKanaal] = useState<Kanaal>('telefoon');
  const [responsSamenvatting, setResponsSamenvatting] = useState('');

  const geadresseerdeAanwezig = model.geadresseerdeAanwezig || heeftPersistedGeadresseerde;
  const briefVoorbereid = model.briefVoorbereid || heeftPersistedBrief;
  const briefVerzonden = model.briefVerzonden || heeftPersistedVerstuurd;
  const reactieOntvangen = model.reactieOntvangen || heeftPersistedRespons;

  const faseLabel = isVastgoedkans && reactieOntvangen
    ? 'Reactie geregistreerd'
    : isVastgoedkans && briefVerzonden
      ? 'Opvolgen'
      : isVastgoedkans && briefVoorbereid
        ? 'Verzending registreren'
        : model.faseLabel;
  const primaireActie = isVastgoedkans && reactieOntvangen
    ? 'Beoordeel de reactie en bepaal bewust de vervolgstap'
    : isVastgoedkans && briefVerzonden
      ? 'Voer de geplande opvolging uit of registreer een reactie'
      : isVastgoedkans && briefVoorbereid
        ? 'Genereer de PDF en registreer daarna de werkelijke verzending'
        : model.primaireActie;
  const toelichting = isVastgoedkans && reactieOntvangen
    ? 'De reactie staat op de verstuurde brief. De Vastgoedkans-status verandert niet automatisch.'
    : isVastgoedkans && briefVerzonden
      ? 'De verzending is vastgelegd. Gebruik de berekende opvolgdatum of registreer de feitelijke reactie.'
      : isVastgoedkans && briefVoorbereid
        ? 'Het concept staat in het dossier. PDF-generatie is lokaal; markeren als verstuurd gebeurt alleen na expliciete bevestiging.'
        : model.toelichting;

  const slaResponsOp = async () => {
    if (!verstuurdeBrief || !responsdatum) return;
    await registreerRespons.mutateAsync({
      id: verstuurdeBrief.id,
      vastgoedkans_id: model.dossier.bronId,
      responsstatus,
      responsdatum,
      respons_kanaal: responsKanaal,
      respons_samenvatting: responsSamenvatting.trim() || null,
    });
  };

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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Volgende actie</p>
            <p className="mt-1 text-sm font-medium">{primaireActie}</p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {isVastgoedkans && <div><dt className="text-muted-foreground">Eigenaar in Eigenaarsregister</dt><dd className="font-medium">{jaNee(eigenaarInRegister)}</dd></div>}
            <div><dt className="text-muted-foreground">CRM-relatie gekoppeld (optioneel)</dt><dd className="font-medium">{jaNee(model.relatieGekoppeld)}</dd></div>
            <div><dt className="text-muted-foreground">Geadresseerde gecontroleerd</dt><dd className="font-medium">{jaNee(geadresseerdeAanwezig)}</dd></div>
            <div><dt className="text-muted-foreground">Brief voorbereid</dt><dd className="font-medium">{jaNee(briefVoorbereid)}</dd></div>
            <div><dt className="text-muted-foreground">Brief verzonden</dt><dd className="font-medium">{jaNee(briefVerzonden)}</dd></div>
            <div><dt className="text-muted-foreground">Reactie geregistreerd</dt><dd className="font-medium">{jaNee(reactieOntvangen)}</dd></div>
          </dl>

          {commando && onCommando && (
            <AcquisitieWerkstroomBediening commando={commando} onUitvoeren={onCommando} bezig={commandoBezig} />
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
          eigenaren={eigenaarOpties}
          enabled={model.eigenaarBekend || eigenaarInRegister}
        />
      )}

      {isVastgoedkans && verstuurdeBrief && (
        <section id="vastgoedkans-briefrespons" className="section-card p-4 sm:p-5">
          <h2 className="font-medium">Reactie & vervolg</h2>
          <p className="mt-1 text-xs text-muted-foreground">Registreer de feitelijke reactie op Brief 1. Er wordt geen taak of Vastgoedkans-status automatisch gewijzigd.</p>
          {verstuurdeBrief.responsstatus && (
            <p className="mt-3 text-sm">Opgeslagen: {RESPONS_LABEL[verstuurdeBrief.responsstatus as Responsstatus]}</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>Reactie</Label><select className={selectClass} value={responsstatus} onChange={(e) => setResponsstatus(e.target.value as Responsstatus)}>{RESPONS_VOLGORDE.map((status) => <option key={status} value={status}>{RESPONS_LABEL[status]}</option>)}</select></div>
            <div><Label>Datum</Label><Input type="date" value={responsdatum} onChange={(e) => setResponsdatum(e.target.value)} /></div>
            <div><Label>Kanaal</Label><select className={selectClass} value={responsKanaal} onChange={(e) => setResponsKanaal(e.target.value as Kanaal)}><option value="telefoon">Telefoon</option><option value="email">E-mail</option><option value="post">Post</option><option value="whatsapp">WhatsApp</option><option value="linkedin">LinkedIn</option><option value="anders">Anders</option></select></div>
            <div className="sm:col-span-2"><Label>Samenvatting</Label><Textarea rows={3} value={responsSamenvatting} onChange={(e) => setResponsSamenvatting(e.target.value)} /></div>
          </div>
          <Button className="mt-4" onClick={slaResponsOp} disabled={registreerRespons.isPending || !responsdatum}>{registreerRespons.isPending ? 'Opslaan…' : 'Reactie opslaan'}</Button>
        </section>
      )}

      <AcquisitieBriefHistorieKaart model={model.briefDossier} />
    </div>
  );
}
