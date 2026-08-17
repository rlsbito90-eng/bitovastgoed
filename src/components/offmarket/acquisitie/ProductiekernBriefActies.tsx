import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileCheck2, Loader2, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useOffMarketBrievenForSignaal, type OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import { maakBestaandConceptDefinitief } from '@/lib/offMarket/acquisitie/bestaandConceptNaarProductie';
import ProductiekernPrintbatchActies from './ProductiekernPrintbatchActies';

interface Props {
  signaalId: string;
}

function geadresseerdeLabel(brief: OffMarketBrief): string {
  return brief.eigenaar_bedrijfsnaam?.trim()
    || brief.eigenaar_naam?.trim()
    || 'Geadresseerde';
}

/**
 * Expliciete Productiekern-actie in de Acquisitie-Focus.
 *
 * Zolang de centrale Productiekern-releasepoort dicht staat rendert dit
 * component niets. Er ontstaat dus geen half-actieve productieknop door alleen
 * de frontend te deployen. Definitief maken gebeurt uitsluitend op een reeds
 * opgeslagen postconcept en nooit automatisch bij openen/downloaden.
 *
 * BUILD A: vóór de gebruiker een BR kan uitgeven wordt read-only gecontroleerd
 * of de acquisitieselectie al een formeel Productiekern-dossier heeft. Een
 * ontbrekend dossier wordt als menselijk leesbare aandachtstatus getoond in
 * plaats van pas na klikken de technische fout `dossier_niet_gestart` te tonen.
 */
export default function ProductiekernBriefActies({ signaalId }: Props) {
  const qc = useQueryClient();
  const { data: selectie = [] } = useAcquisitieSelectie();
  const { data: brieven = [] } = useOffMarketBrievenForSignaal(signaalId);
  const [bezigId, setBezigId] = useState<string | null>(null);

  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);
  const lezen = useMemo(() => maakStandaardProductiekernBrowserLeesSamenstelling(), []);

  const selectieItem = useMemo(
    () => selectie.find((item) => item.signaal_id === signaalId) ?? null,
    [selectie, signaalId],
  );

  const dossierQuery = useQuery({
    queryKey: ['off-market-acquisitie-productiekern', 'brief-preflight', selectieItem?.id ?? null],
    enabled: Boolean(
      selectieItem?.id
      && writes.activatie.schrijvenActief
      && lezen.activatie.lezenActief,
    ),
    queryFn: async () => {
      if (!selectieItem) return null;
      const dossiers = await lezen.bulkRepository.haalDossiersOpSelectieIds([selectieItem.id]);
      return dossiers.find((dossier) => dossier.selectieId === selectieItem.id) ?? null;
    },
    staleTime: 15_000,
  });

  const postConcepten = useMemo(
    () => brieven.filter((brief) =>
      (brief.kanaal ?? 'post') === 'post'
      && brief.status === 'concept'
      && !brief.archived_at,
    ),
    [brieven],
  );

  const definitieveBrieven = useMemo(
    () => brieven.filter((brief) => (brief as OffMarketBrief & { status: string }).status === 'definitief'),
    [brieven],
  );

  const actief = writes.activatie.schrijvenActief && lezen.activatie.lezenActief;
  if (!actief) return null;
  if (!selectieItem || (postConcepten.length === 0 && definitieveBrieven.length === 0)) return null;

  const dossierOntbreekt = !dossierQuery.isLoading && !dossierQuery.isError && !dossierQuery.data;
  const finalisatieGeblokkeerd = dossierQuery.isLoading || dossierQuery.isError || dossierOntbreekt;

  const maakDefinitief = async (brief: OffMarketBrief) => {
    if (bezigId || finalisatieGeblokkeerd) return;
    setBezigId(brief.id);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.id) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');

      const resultaat = await maakBestaandConceptDefinitief({
        selectieId: selectieItem.id,
        signaalId,
        brief,
        actorId: data.user.id,
      }, {
        bridge: writes.bestaandConceptBridgeRepository,
        vroeg: writes.vroegeRepository,
        lezen: lezen.repository,
        transacties: writes.transactieRepository,
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['off_market_brieven', signaalId] }),
        qc.invalidateQueries({ queryKey: ['off-market-acquisitie-selectie'] }),
        qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] }),
        qc.invalidateQueries({ queryKey: ['off-market-kpi'] }),
        qc.invalidateQueries({ queryKey: ['off-market-acquisitie-productiekern'] }),
      ]);
      toast.success(`Brief definitief: ${resultaat.briefnummer}`);
    } catch (e) {
      const melding = e instanceof Error ? e.message : 'Definitief maken is mislukt.';
      toast.error(
        melding === 'dossier_niet_gestart'
          ? 'Productiedossier is nog niet gestart. Los dit eerst op bij Aandacht vereist.'
          : melding,
      );
    } finally {
      setBezigId(null);
    }
  };

  return (
    <section
      className="rounded-lg border border-border bg-card p-3 space-y-2"
      data-testid="productiekern-brief-acties"
    >
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Briefproductie</p>
      </div>

      {dossierQuery.isLoading && postConcepten.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Productiegereedheid controleren…
        </div>
      )}

      {dossierOntbreekt && postConcepten.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
          data-testid="productiekern-aandacht-dossier-niet-gestart"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Aandacht vereist: productiedossier nog niet gestart</p>
            <p className="text-muted-foreground">
              Deze bestaande selectie heeft wel een conceptbrief, maar nog geen formeel Productiekern-dossier.
              De brief kan daarom nog niet veilig een BR krijgen.
            </p>
          </div>
        </div>
      )}

      {dossierQuery.isError && postConcepten.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Productiegereedheid kon niet worden gecontroleerd</p>
            <p className="text-muted-foreground">Definitief maken blijft veilig geblokkeerd. Probeer na een refresh opnieuw.</p>
          </div>
        </div>
      )}

      {definitieveBrieven.map((brief) => {
        const nummer = (brief as OffMarketBrief & { briefnummer?: string | null }).briefnummer;
        return (
          <div key={`def-${brief.id}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>{geadresseerdeLabel(brief)}</span>
            <span className="font-mono-data font-semibold">{nummer || 'Definitief'}</span>
          </div>
        );
      })}

      {postConcepten.map((brief) => (
        <div key={brief.id} className="flex flex-wrap items-end justify-between gap-2 rounded-md border bg-background/60 p-2">
          <div className="min-w-0 text-xs space-y-1">
            <p className="font-medium truncate">{geadresseerdeLabel(brief)}</p>
            <p className="whitespace-pre-line text-[11px] leading-4 text-foreground/80">
              {brief.verzendadres || 'Geen verzendadres'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Controleer naam en verzendadres. Met “Definitief maken” bevestig je deze gegevens voor de formele BR-versie; latere wijzigingen vereisen een nieuwe brief.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void maakDefinitief(brief)}
            disabled={!!bezigId || finalisatieGeblokkeerd}
            data-testid={`productiekern-definitief-${brief.id}`}
          >
            {bezigId === brief.id || dossierQuery.isLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileCheck2 className="h-4 w-4" />}
            Definitief maken (BR)
          </Button>
        </div>
      ))}

      {postConcepten.length === 0 && definitieveBrieven.length > 0 && (
        <ProductiekernPrintbatchActies
          signaalId={signaalId}
          briefIds={definitieveBrieven.map((brief) => brief.id)}
        />
      )}
    </section>
  );
}
