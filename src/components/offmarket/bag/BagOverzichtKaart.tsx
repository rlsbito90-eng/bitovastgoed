// V2.3 — BAG-overzichtskaart op de Onderzoek-tab.
// Toont geaggregeerde BAG-data + handmatige verrijkknoppen.
import { useState } from 'react';
import { Building2, RefreshCw, Sparkles, FileSearch, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useBagVerrijken } from '@/hooks/useBagVerrijken';
import { useEnrichSignaal } from '@/hooks/useEnrichSignaal';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { BAG_STATUS_LABEL } from '@/lib/offMarket/bag/types';
import type { BagStatus, BagVbo, SignaalBagInput } from '@/lib/offMarket/bag/types';
import KadasteradviesBadge from './KadasteradviesBadge';
import BagVboLijst from './BagVboLijst';

interface Props {
  signaal: OffMarketSignaal;
  onOpenKadaster?: () => void;
}

function fmtNum(v: number | null | undefined, suffix = '') {
  if (v == null) return '—';
  return `${v}${suffix}`;
}

export default function BagOverzichtKaart({ signaal, onOpenKadaster }: Props) {
  const s = signaal as unknown as Record<string, unknown> & OffMarketSignaal;
  const bagStatus = (s.bag_status as BagStatus | null | undefined) ?? 'niet_verrijkt';
  const matchKw = (s.bag_match_kwaliteit as string | null | undefined) ?? null;
  const totaalOpp = (s.bag_totaal_oppervlakte_m2 as number | null | undefined) ?? null;
  const aantalVbo = (s.bag_aantal_vbo as number | null | undefined) ?? null;
  const aantalPanden = (s.bag_aantal_panden as number | null | undefined) ?? null;
  const gebruiksdoelen = (s.bag_gebruiksdoelen as string[] | null | undefined) ?? [];
  const bouwjaar = (s.bag_bouwjaar as number | null | undefined) ?? null;
  const vbos = (s.bag_vbos as unknown as BagVbo[] | null | undefined) ?? null;
  const foutmelding = (s.bag_foutmelding as string | null | undefined) ?? null;

  const advies = berekenKadasteradvies(s as unknown as SignaalBagInput);

  const bag = useBagVerrijken();
  const ai = useEnrichSignaal();
  const [laatsteFout, setLaatsteFout] = useState<string | null>(null);

  const handmatigBag = async () => {
    setLaatsteFout(null);
    try {
      await bag.mutateAsync({ signaalId: signaal.id, force: true });
      toast.success('BAG-gegevens opgehaald.');
    } catch (e: any) {
      const m = e?.message ?? 'BAG-verrijking mislukt';
      setLaatsteFout(m);
      toast.error(m);
    }
  };
  const handmatigAi = async () => {
    try {
      await ai.mutateAsync({ signaalId: signaal.id, force: true });
      toast.success('AI-analyse vernieuwd.');
    } catch (e: any) {
      toast.error(e?.message ?? 'AI-verrijking mislukt');
    }
  };

  return (
    <section
      data-testid="bag-overzicht-kaart"
      className="section-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">BAG-overzicht</h2>
          <span
            data-testid="bag-status-badge"
            data-status={bagStatus}
            className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
          >
            {BAG_STATUS_LABEL[bagStatus] ?? bagStatus}
          </span>
          <KadasteradviesBadge niveau={advies.niveau} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handmatigAi}
            disabled={ai.isPending}
            data-testid="ai-opnieuw-verrijken-knop"
          >
            <Sparkles className={`h-3.5 w-3.5 ${ai.isPending ? 'animate-pulse' : ''}`} />
            AI opnieuw verrijken
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handmatigBag}
            disabled={bag.isPending}
            data-testid="bag-verrijken-knop"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${bag.isPending ? 'animate-spin' : ''}`} />
            BAG verrijken
          </Button>
          <Button
            size="sm"
            onClick={onOpenKadaster}
            data-testid="kadaster-ophalen-knop"
          >
            <FileSearch className="h-3.5 w-3.5" />
            Kadaster ophalen
          </Button>
        </div>
      </div>

      {(foutmelding || laatsteFout) && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{laatsteFout ?? foutmelding}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Totaal oppervlak" value={fmtNum(totaalOpp, ' m²')} testid="bag-stat-opp" />
        <Stat label="Aantal VBO's" value={fmtNum(aantalVbo)} testid="bag-stat-vbo" />
        <Stat label="Aantal panden" value={fmtNum(aantalPanden)} testid="bag-stat-panden" />
        <Stat label="Bouwjaar" value={fmtNum(bouwjaar)} testid="bag-stat-bouwjaar" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Gebruiksdoelen</p>
          <p className="text-foreground" data-testid="bag-gebruiksdoelen">
            {gebruiksdoelen.length ? gebruiksdoelen.join(', ') : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Matchkwaliteit</p>
          <p className="text-foreground" data-testid="bag-matchkwaliteit">
            {matchKw ?? '—'}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 pt-3 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Verblijfsobjecten</p>
        <BagVboLijst vbos={vbos} />
      </div>

      {advies.niveau && (
        <div
          data-testid="bag-advies-reden"
          className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="text-foreground font-medium">Kadasteradvies:</span> {advies.reden}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div data-testid={testid}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-mono-data text-foreground mt-0.5">{value}</p>
    </div>
  );
}
