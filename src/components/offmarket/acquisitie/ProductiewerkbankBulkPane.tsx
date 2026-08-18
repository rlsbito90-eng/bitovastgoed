import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileCheck2, Loader2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { AcquisitieSelectieItem } from '@/hooks/useAcquisitieSelectie';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { maakBestaandConceptDefinitief, parseProductiekernVerzendadres } from '@/lib/offMarket/acquisitie/bestaandConceptNaarProductie';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import {
  bepaalProductiePreflight,
  productiePreflightRedenLabel,
} from '@/lib/offMarket/acquisitie/productiewerkbankPreflight';

interface Props {
  geselecteerdeSignaalIds: ReadonlySet<string>;
  selecties: readonly AcquisitieSelectieItem[];
  brieven: readonly OffMarketBrief[];
}

function isFormeelFinaliseerbaarPostadres(adres: string | null | undefined): boolean {
  try {
    parseProductiekernVerzendadres(adres);
    return true;
  } catch {
    return false;
  }
}

function briefLabel(brief: OffMarketBrief | undefined): string {
  if (!brief) return 'Dossier';
  return brief.eigenaar_bedrijfsnaam?.trim()
    || brief.eigenaar_naam?.trim()
    || brief.objectomschrijving?.trim()
    || 'Geadresseerde';
}

function operationKeyStart(selectieId: string): string {
  const uniek = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `acquisitie:start-verwerking:${selectieId}:${uniek}`;
}

interface BulkResultaat {
  gelukt: number;
  mislukt: Array<{ briefId: string; melding: string }>;
}

export default function ProductiewerkbankBulkPane({
  geselecteerdeSignaalIds,
  selecties,
  brieven,
}: Props) {
  const qc = useQueryClient();
  const [startBezig, setStartBezig] = useState(false);
  const [finaliseerBezig, setFinaliseerBezig] = useState(false);
  const [laatsteResultaat, setLaatsteResultaat] = useState<BulkResultaat | null>(null);

  const lezen = useMemo(() => maakStandaardProductiekernBrowserLeesSamenstelling(), []);
  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);

  const geselecteerdeIds = useMemo(
    () => [...geselecteerdeSignaalIds].sort(),
    [geselecteerdeSignaalIds],
  );

  const geselecteerdeSelecties = useMemo(
    () => selecties.filter((item) => item.signaal_id && geselecteerdeSignaalIds.has(item.signaal_id)),
    [selecties, geselecteerdeSignaalIds],
  );
  const selectieIds = useMemo(
    () => geselecteerdeSelecties.map((item) => item.id).sort(),
    [geselecteerdeSelecties],
  );

  const geselecteerdeBrieven = useMemo(
    () => brieven.filter((brief) => geselecteerdeSignaalIds.has(brief.signaal_id)),
    [brieven, geselecteerdeSignaalIds],
  );

  const dossierQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'productiewerkbank-preflight', selectieIds],
    enabled: lezen.activatie.lezenActief && selectieIds.length > 0,
    queryFn: () => lezen.bulkRepository.haalDossiersOpSelectieIds(selectieIds),
    staleTime: 10_000,
  });

  const formeleDossierSelectieIds = useMemo(
    () => new Set((dossierQuery.data ?? []).map((dossier) => dossier.selectieId)),
    [dossierQuery.data],
  );

  const preflight = useMemo(() => bepaalProductiePreflight({
    geselecteerdeSignaalIds: geselecteerdeIds,
    selecties: geselecteerdeSelecties
      .filter((item): item is AcquisitieSelectieItem & { signaal_id: string } => Boolean(item.signaal_id))
      .map((item) => ({ selectieId: item.id, signaalId: item.signaal_id })),
    formeleDossierSelectieIds,
    brieven: geselecteerdeBrieven.map((brief) => ({
      id: brief.id,
      signaalId: brief.signaal_id,
      kanaal: brief.kanaal,
      status: (brief as OffMarketBrief & { status?: string | null }).status,
      archivedAt: brief.archived_at,
      eigenaarNaam: brief.eigenaar_naam,
      eigenaarBedrijfsnaam: brief.eigenaar_bedrijfsnaam,
      verzendadres: brief.verzendadres,
    })),
    isVolledigPostadres: isFormeelFinaliseerbaarPostadres,
  }), [
    geselecteerdeIds,
    geselecteerdeSelecties,
    formeleDossierSelectieIds,
    geselecteerdeBrieven,
  ]);

  const briefPerId = useMemo(
    () => new Map(geselecteerdeBrieven.map((brief) => [brief.id, brief] as const)),
    [geselecteerdeBrieven],
  );
  const selectiePerSignaal = useMemo(
    () => new Map(
      geselecteerdeSelecties
        .filter((item): item is AcquisitieSelectieItem & { signaal_id: string } => Boolean(item.signaal_id))
        .map((item) => [item.signaal_id, item] as const),
    ),
    [geselecteerdeSelecties],
  );

  if (geselecteerdeIds.length === 0) return null;
  if (!lezen.activatie.lezenActief) return null;

  const aandacht = preflight.regels.filter((regel) => regel.status === 'aandacht');
  const gereed = preflight.regels.filter((regel) => regel.status === 'gereed');
  const verwerkt = preflight.regels.filter((regel) => regel.status === 'verwerkt');
  const teStartenSelectieIds = [...new Set(
    aandacht
      .filter((regel) => regel.reden === 'productiedossier_niet_gestart' && regel.selectieId)
      .map((regel) => regel.selectieId!),
  )];

  const invalidereerProductie = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['off-market-brieven-bulk'] }),
      qc.invalidateQueries({ queryKey: ['off-market-acquisitie-selectie'] }),
      qc.invalidateQueries({ queryKey: ['off-market-acquisitie-productiekern'] }),
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] }),
    ]);
  };

  const startProductiedossiers = async () => {
    if (startBezig || teStartenSelectieIds.length === 0 || !writes.activatie.schrijvenActief) return;
    const bevestigd = window.confirm(
      `${teStartenSelectieIds.length} formele productiedossier${teStartenSelectieIds.length === 1 ? '' : 's'} starten?\n\n`
      + 'Dit maakt uitsluitend de ontbrekende Productiekern-dossiers aan. Er wordt geen BR, BAT, print- of poststatus gemaakt.',
    );
    if (!bevestigd) return;

    setStartBezig(true);
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user?.id) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');
      let gelukt = 0;
      const fouten: string[] = [];
      for (const selectieId of teStartenSelectieIds) {
        try {
          await writes.vroegeRepository.startVerwerking({
            selectieId,
            actorId: auth.data.user.id,
            operationKey: operationKeyStart(selectieId),
          });
          gelukt += 1;
        } catch (error) {
          fouten.push(error instanceof Error ? error.message : `Dossier ${selectieId} kon niet worden gestart.`);
        }
      }
      await invalidereerProductie();
      if (fouten.length === 0) {
        toast.success(`${gelukt} productiedossier${gelukt === 1 ? '' : 's'} gestart.`);
      } else {
        toast.warning(`${gelukt} gestart, ${fouten.length} vereist aandacht.`, { description: fouten[0] });
      }
    } finally {
      setStartBezig(false);
    }
  };

  const finaliseerGereed = async () => {
    if (finaliseerBezig || gereed.length === 0 || !writes.activatie.schrijvenActief) return;
    const bevestigd = window.confirm(
      `${gereed.length} ${gereed.length === 1 ? 'brief' : 'brieven'} definitief maken?\n\n`
      + 'Iedere brief krijgt een eigen formeel BR-nummer en immutable versie. Controleer de conceptbrieven vóór deze stap.',
    );
    if (!bevestigd) return;

    setFinaliseerBezig(true);
    setLaatsteResultaat(null);
    const resultaat: BulkResultaat = { gelukt: 0, mislukt: [] };
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || !auth.data.user?.id) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');

      for (const regel of gereed) {
        if (!regel.briefId) continue;
        const brief = briefPerId.get(regel.briefId);
        const selectie = selectiePerSignaal.get(regel.signaalId);
        if (!brief || !selectie) {
          resultaat.mislukt.push({ briefId: regel.briefId, melding: 'Brief of acquisitieselectie kon niet worden teruggevonden.' });
          continue;
        }
        try {
          await maakBestaandConceptDefinitief({
            selectieId: selectie.id,
            signaalId: regel.signaalId,
            brief,
            actorId: auth.data.user.id,
          }, {
            bridge: writes.bestaandConceptBridgeRepository,
            vroeg: writes.vroegeRepository,
            lezen: lezen.repository,
            transacties: writes.transactieRepository,
          });
          resultaat.gelukt += 1;
        } catch (error) {
          resultaat.mislukt.push({
            briefId: regel.briefId,
            melding: error instanceof Error ? error.message : 'Definitief maken is mislukt.',
          });
        }
      }

      setLaatsteResultaat(resultaat);
      await invalidereerProductie();
      if (resultaat.mislukt.length === 0) {
        toast.success(`${resultaat.gelukt} ${resultaat.gelukt === 1 ? 'brief is' : 'brieven zijn'} definitief gemaakt.`);
      } else {
        toast.warning(
          `${resultaat.gelukt} definitief, ${resultaat.mislukt.length} vereist aandacht.`,
          { description: 'Geslaagde BR’s blijven geldig; alleen de resterende brieven hoeven opnieuw.' },
        );
      }
    } finally {
      setFinaliseerBezig(false);
    }
  };

  const aandachtRegels = aandacht.slice(0, 8);
  const verwerkteRegels = verwerkt.slice(0, 8);

  return (
    <section
      className="section-card space-y-3 px-3 py-3"
      data-testid="acquisitie-productiewerkbank-bulk"
      aria-label="Productiewerkbank preflight"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Productiewerkbank</p>
          <p className="text-[11px] text-muted-foreground break-words">
            Concept = controleren · Definitief = BR · printproductie volgt pas via een formele BAT.
          </p>
        </div>
        {dossierQuery.isLoading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preflight controleren…
          </span>
        )}
      </div>

      {dossierQuery.isError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <p className="font-medium">Productiegereedheid kon niet veilig worden gelezen</p>
            <p className="text-muted-foreground">Formele bulkacties blijven geblokkeerd. Refresh en probeer opnieuw.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-xs" data-testid="productiewerkbank-preflight-telling">
          <div className="rounded-md border bg-background px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gereed</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{dossierQuery.isLoading ? '–' : gereed.length}</p>
          </div>
          <div className="rounded-md border bg-background px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aandacht</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{dossierQuery.isLoading ? '–' : aandacht.length}</p>
          </div>
          <div className="rounded-md border bg-background px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Al verwerkt</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{dossierQuery.isLoading ? '–' : verwerkt.length}</p>
          </div>
        </div>
      )}

      {!dossierQuery.isLoading && !dossierQuery.isError && aandachtRegels.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs">
          <div className="mb-1.5 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Aandacht vereist ({aandacht.length})
          </div>
          <ul className="space-y-1.5 text-muted-foreground">
            {aandachtRegels.map((regel, index) => (
              <li
                key={`${regel.signaalId}:${regel.briefId ?? index}`}
                className="flex flex-col gap-0.5 rounded-sm py-0.5 sm:flex-row sm:items-start sm:gap-2"
              >
                <span className="min-w-0 flex-1 break-words text-foreground/80">
                  {briefLabel(regel.briefId ? briefPerId.get(regel.briefId) : undefined)}
                </span>
                <span className="break-words sm:shrink-0 sm:text-right">
                  {productiePreflightRedenLabel(regel.reden)}
                </span>
              </li>
            ))}
          </ul>
          {aandacht.length > aandachtRegels.length && (
            <p className="mt-1.5 text-muted-foreground">+ {aandacht.length - aandachtRegels.length} meer</p>
          )}
        </div>
      )}

      {!dossierQuery.isLoading && !dossierQuery.isError && verwerkteRegels.length > 0 && (
        <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-xs" data-testid="productiewerkbank-al-verwerkt-lijst">
          <div className="mb-1.5 flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Al verwerkt ({verwerkt.length})
          </div>
          <ul className="space-y-1.5 text-muted-foreground">
            {verwerkteRegels.map((regel, index) => (
              <li
                key={`${regel.signaalId}:${regel.briefId ?? index}:verwerkt`}
                className="flex flex-col gap-0.5 rounded-sm py-0.5 sm:flex-row sm:items-start sm:gap-2"
              >
                <span className="min-w-0 flex-1 break-words text-foreground/80">
                  {briefLabel(regel.briefId ? briefPerId.get(regel.briefId) : undefined)}
                </span>
                <span className="break-words sm:shrink-0 sm:text-right">
                  {productiePreflightRedenLabel(regel.reden) ?? 'Al verwerkt'}
                </span>
              </li>
            ))}
          </ul>
          {verwerkt.length > verwerkteRegels.length && (
            <p className="mt-1.5 text-muted-foreground">+ {verwerkt.length - verwerkteRegels.length} meer</p>
          )}
        </div>
      )}

      {laatsteResultaat && (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs" data-testid="productiewerkbank-laatste-resultaat">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Laatste finalisatie: {laatsteResultaat.gelukt} gelukt · {laatsteResultaat.mislukt.length} aandacht
          </p>
          {laatsteResultaat.mislukt.slice(0, 3).map((fout) => (
            <p key={fout.briefId} className="mt-1 break-words text-muted-foreground">
              {briefLabel(briefPerId.get(fout.briefId))}: {fout.melding}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {teStartenSelectieIds.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void startProductiedossiers()}
            disabled={startBezig || dossierQuery.isLoading || dossierQuery.isError || !writes.activatie.schrijvenActief}
            data-testid="productiewerkbank-start-dossiers"
            className="w-full sm:w-auto"
          >
            {startBezig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            Productiedossiers starten ({teStartenSelectieIds.length})
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => void finaliseerGereed()}
          disabled={finaliseerBezig || gereed.length === 0 || dossierQuery.isLoading || dossierQuery.isError || !writes.activatie.schrijvenActief}
          data-testid="productiewerkbank-finaliseer-gereed"
          className="w-full sm:w-auto"
        >
          {finaliseerBezig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5" />}
          Brieven definitief maken ({gereed.length})
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground break-words">
        Geen enkele actie hierboven print of post automatisch. Definitieve brieven worden na BR apart klaargezet voor een formele printbatch.
      </p>
    </section>
  );
}
