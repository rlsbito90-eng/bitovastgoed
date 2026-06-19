// V2.4 — Resolver bij meerdere/onzekere BAG-matches.
// Toont kandidaten; gebruiker kiest het juiste doelobject.

import { AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useBagVerrijken } from '@/hooks/useBagVerrijken';
import { buildBagViewerUrl } from '@/lib/offMarket/bag/bagViewer';
import type { BagMatchKandidaat } from '@/lib/offMarket/bag/types';

interface Props {
  signaalId: string;
  kandidaten: BagMatchKandidaat[];
}

function shortId(v: string | null | undefined, len = 8): string {
  if (!v) return '';
  return v.length > len ? `${v.slice(0, len)}…` : v;
}

export default function BagMatchResolver({ signaalId, kandidaten }: Props) {
  const bag = useBagVerrijken();

  const kies = async (k: BagMatchKandidaat) => {
    try {
      await bag.mutateAsync({
        signaalId,
        force: true,
        selected_vbo_id: k.vbo_id ?? undefined,
        selected_nummeraanduiding_id: k.nummeraanduiding_id ?? undefined,
      });
      toast.success('BAG-match gekozen en pandcontext opgehaald.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Match-selectie mislukt');
    }
  };

  return (
    <section
      data-testid="bag-match-resolver"
      className="rounded-md border border-amber-300/60 bg-amber-50/60 p-3 space-y-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Meerdere BAG-matches gevonden
          </p>
          <p className="text-xs text-amber-900/80">
            Kies het adres dat het beste bij het signaal hoort. Daarna wordt de BAG-pandcontext opgehaald.
          </p>
        </div>
      </div>

      <ul className="space-y-2" data-testid="bag-match-kandidaten">
        {kandidaten.map((k, idx) => {
          const id = k.vbo_id ?? k.nummeraanduiding_id ?? String(idx);
          return (
            <li
              key={id}
              data-testid="bag-match-kandidaat"
              className="rounded-md border border-border bg-card px-3 py-2 flex flex-wrap gap-3 items-start justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{k.adres || '—'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {k.opp_m2 != null ? `${k.opp_m2} m²` : 'oppervlak onbekend'}
                  {k.gebruiksdoel?.length ? ` · ${k.gebruiksdoel.join(', ')}` : ''}
                  {k.status ? ` · ${k.status}` : ''}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono-data">
                  {k.vbo_id ? `VBO ${shortId(k.vbo_id)}` : ''}
                  {k.nummeraanduiding_id ? ` · NA ${shortId(k.nummeraanduiding_id)}` : ''}
                  {k.match_kwaliteit ? ` · ${k.match_kwaliteit}` : ''}
                </p>
                {k.match_reden && (
                  <p className="text-[10px] text-muted-foreground italic">{k.match_reden}</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => kies(k)}
                  disabled={bag.isPending}
                  data-testid="bag-match-kies-knop"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Gebruik deze match
                </Button>
                <a
                  href={buildBagViewerUrl(k.adres)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="bag-match-viewer-link"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border hover:bg-muted"
                >
                  <ExternalLink className="h-3 w-3" />
                  BAG Viewer
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
