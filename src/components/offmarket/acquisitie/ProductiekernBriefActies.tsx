import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Loader2, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useOffMarketBrievenForSignaal, type OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import { maakBestaandConceptDefinitief } from '@/lib/offMarket/acquisitie/bestaandConceptNaarProductie';

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

  const maakDefinitief = async (brief: OffMarketBrief) => {
    if (bezigId) return;
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
      ]);
      toast.success(`Brief definitief: ${resultaat.briefnummer}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Definitief maken is mislukt.');
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
        <div key={brief.id} className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-xs">
            <p className="font-medium truncate">{geadresseerdeLabel(brief)}</p>
            <p className="text-[11px] text-muted-foreground">
              Opgeslagen concept · wijzigingen worden eerst als nieuwe immutable versie vastgelegd
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void maakDefinitief(brief)}
            disabled={!!bezigId}
            data-testid={`productiekern-definitief-${brief.id}`}
          >
            {bezigId === brief.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileCheck2 className="h-4 w-4" />}
            Definitief maken (BR)
          </Button>
        </div>
      ))}
    </section>
  );
}
