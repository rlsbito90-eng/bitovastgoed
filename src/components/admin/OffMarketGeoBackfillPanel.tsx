// Admin-paneel voor backfill van geo-verrijking via PDOK.
import { useEffect, useState } from 'react';
import { Globe2, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { startGeoBackfill, GEO_FUNCTION_NAME, type BackfillTellers } from '@/lib/offMarket/geo';

interface Counts { totaal: number; verrijkt: number; niet_verrijkt: number; geen_coordinaten: number; geen_match: number; fout: number; }

export default function OffMarketGeoBackfillPanel() {
  const [limit, setLimit] = useState<number>(50);
  const [force, setForce] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [tellers, setTellers] = useState<BackfillTellers | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);

  const ladenCounts = async () => {
    const statussen = ['verrijkt', 'niet_verrijkt', 'geen_coordinaten', 'geen_match', 'fout'] as const;
    const totals: any = { totaal: 0 };
    for (const st of statussen) {
      const { count } = await supabase
        .from('off_market_signalen')
        .select('id', { count: 'exact', head: true })
        .eq('geo_status', st);
      totals[st] = count ?? 0;
      totals.totaal += count ?? 0;
    }
    setCounts(totals);
  };

  useEffect(() => { ladenCounts(); }, []);

  const draaien = async () => {
    if (bezig) return;
    setBezig(true);
    setTellers(null);
    setFoutmelding(null);
    const res = await startGeoBackfill({ limit, force });
    setBezig(false);
    if (!res.ok) {
      const msg = res.error ?? 'Geo-backfill mislukt.';
      setFoutmelding(msg);
      toast.error(`Geo-verrijking kon niet worden gestart: ${msg}`);
      return;
    }
    setTellers(res.tellers ?? null);
    toast.success(`Geo-backfill klaar: ${res.tellers?.verrijkt ?? 0} verrijkt`);
    await ladenCounts();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-muted-foreground" /> Geo-verrijking (PDOK)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vul officiële gemeente, wijk en buurt aan op bestaande Off-Market signalen op basis van coördinaten.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        {counts && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <Stat label="Totaal" value={counts.totaal} />
            <Stat label="Verrijkt" value={counts.verrijkt} tone="success" />
            <Stat label="Niet verrijkt" value={counts.niet_verrijkt} />
            <Stat label="Geen coördinaten" value={counts.geen_coordinaten} />
            <Stat label="Geen match / fout" value={counts.geen_match + counts.fout} tone={counts.fout > 0 ? 'destructive' : undefined} />
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Batchgrootte</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm h-9">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span>Ook reeds verrijkte signalen opnieuw doen</span>
          </label>
          <Button onClick={draaien} disabled={bezig} className="ml-auto">
            {bezig ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
            Geo-verrijking draaien
          </Button>
        </div>

        {tellers && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs pt-2 border-t border-border">
            <Stat label="Verwerkt" value={tellers.totaal} />
            <Stat label="Verrijkt" value={tellers.verrijkt} tone="success" />
            <Stat label="Overgeslagen" value={tellers.skipped} />
            <Stat label="Geen coördinaten" value={tellers.geen_coordinaten} />
            <Stat label="Geen match" value={tellers.geen_match} />
            <Stat label="Fouten" value={tellers.fout} tone={tellers.fout > 0 ? 'destructive' : undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'destructive' }) {
  const cls = tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono-data text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
