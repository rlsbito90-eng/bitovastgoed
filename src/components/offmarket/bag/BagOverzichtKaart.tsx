// V2.3 — BagOverzichtKaart op de Onderzoek-tab.
// V2.4 — uitgebreid met Doelobject + BAG-pandcontext en multiple-match resolver.
import { useState } from 'react';
import { Building2, RefreshCw, Sparkles, FileSearch, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useBagVerrijken } from '@/hooks/useBagVerrijken';
import { useEnrichSignaal } from '@/hooks/useEnrichSignaal';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { BAG_STATUS_LABEL } from '@/lib/offMarket/bag/types';
import type {
  BagStatus, BagVbo, BagMatchKandidaat, SignaalBagInput,
} from '@/lib/offMarket/bag/types';
import KadasteradviesBadge from './KadasteradviesBadge';
import BagVboLijst from './BagVboLijst';
import BagMatchResolver from './BagMatchResolver';

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
  const pandStatus = (s.bag_pand_status as string | null | undefined) ?? null;
  const vbos = (s.bag_vbos as unknown as BagVbo[] | null | undefined) ?? null;
  const foutmelding = (s.bag_foutmelding as string | null | undefined) ?? null;

  // V2.4
  const kandidaten = (s.bag_match_kandidaten as unknown as BagMatchKandidaat[] | null | undefined) ?? null;
  const gekozenVboId = (s.bag_geselecteerd_vbo_id as string | null | undefined) ?? null;
  const gekozenNaId = (s.bag_geselecteerd_nummeraanduiding_id as string | null | undefined) ?? null;
  const gekozenAdres = (s.bag_geselecteerd_adres as string | null | undefined) ?? null;
  const gekozenOpp = (s.bag_geselecteerd_opp_m2 as number | null | undefined) ?? null;
  const gekozenGebruik = (s.bag_geselecteerd_gebruiksdoel as string[] | null | undefined) ?? null;
  const pandAantalVbo = (s.bag_pandcontext_aantal_vbo as number | null | undefined) ?? aantalVbo;
  const pandTotaalOpp = (s.bag_pandcontext_totaal_opp_m2 as number | null | undefined) ?? totaalOpp;

  const onzeker = matchKw === 'onzeker' || bagStatus === 'meerdere_matches';
  const toonResolver = !!(kandidaten && kandidaten.length > 0) || onzeker;

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

      {/* V2.4 — Multiple-match resolver bovenaan */}
      {toonResolver && kandidaten && kandidaten.length > 0 && (
        <BagMatchResolver signaalId={signaal.id} kandidaten={kandidaten} />
      )}
      {toonResolver && (!kandidaten || kandidaten.length === 0) && (
        <div
          data-testid="bag-resolver-leeg-waarschuwing"
          data-variant={s.bag_verrijkt_op ? 'oude_data' : 'geen_kandidaten'}
          className="text-xs text-amber-900 bg-amber-50/70 border border-amber-300/60 rounded-md p-2.5"
        >
          {s.bag_verrijkt_op
            ? 'Dit signaal heeft nog oude BAG-matchdata zonder kandidaten. Klik op BAG verrijken om kandidaten op te halen.'
            : 'Er zijn geen bruikbare BAG-kandidaten opgeslagen. Controleer het signaaladres of probeer te zoeken op postcode + huisnummer.'}
        </div>
      )}

      {/* V2.4 — Doelobject */}
      {gekozenAdres && (
        <div data-testid="bag-doelobject-sectie" className="rounded-md border border-border bg-card/60 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Doelobject</p>
          <p className="text-sm text-foreground" data-testid="bag-doelobject-adres">
            {gekozenAdres}
            {gekozenOpp != null ? ` · ${gekozenOpp} m²` : ''}
            {gekozenGebruik?.length ? ` · ${gekozenGebruik.join(', ')}` : ''}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono-data">
            {gekozenVboId ? `VBO ${gekozenVboId.slice(0, 12)}…` : ''}
            {matchKw ? ` · matchkwaliteit: ${matchKw}` : ''}
          </p>
        </div>
      )}

      {/* V2.4 — BAG-pandcontext */}
      <div data-testid="bag-pandcontext-sectie" className="space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">BAG-pandcontext</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Totaal oppervlak" value={fmtNum(pandTotaalOpp, ' m²')} testid="bag-stat-opp" />
          <Stat label="Aantal VBO's" value={fmtNum(pandAantalVbo)} testid="bag-stat-vbo" />
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
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
              Matchkwaliteit / pandstatus
            </p>
            <p className="text-foreground" data-testid="bag-matchkwaliteit">
              {matchKw ?? '—'}{pandStatus ? ` · ${pandStatus}` : ''}
            </p>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Verblijfsobjecten in zelfde BAG-pand
          </p>
          <BagVboLijst
            vbos={vbos}
            geselecteerdVboId={gekozenVboId}
            geselecteerdNummeraanduidingId={gekozenNaId}
          />
        </div>
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
