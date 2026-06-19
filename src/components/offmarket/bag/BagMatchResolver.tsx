// V2.4 — Resolver bij meerdere/onzekere BAG-matches.
// Toont kandidaten als cards; nabijgelegen huisnummers worden niet primair getoond.
// Doelobject-match (MATCH-badge) staat altijd bovenaan.

import { useState, useMemo } from 'react';
import { AlertTriangle, ExternalLink, CheckCircle2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useBagVerrijken } from '@/hooks/useBagVerrijken';
import { buildBagViewerUrl } from '@/lib/offMarket/bag/bagViewer';
import type { BagMatchKandidaat, BagMatchType } from '@/lib/offMarket/bag/types';

interface Props {
  signaalId: string;
  kandidaten: Array<BagMatchKandidaat | null | undefined> | null | undefined;
}

function normalizeBagKandidaat(
  k?: Partial<BagMatchKandidaat> | null,
): BagMatchKandidaat | null {
  if (!k || typeof k !== 'object') return null;
  return {
    adres: k.adres ?? 'Onbekend BAG-adres',
    pdok_id: k.pdok_id ?? null,
    vbo_id: k.vbo_id ?? null,
    nummeraanduiding_id: k.nummeraanduiding_id ?? null,
    opp_m2: typeof k.opp_m2 === 'number' ? k.opp_m2 : null,
    gebruiksdoel: Array.isArray(k.gebruiksdoel) ? k.gebruiksdoel : [],
    status: k.status ?? null,
    pandid: k.pandid ?? null,
    match_type: (k.match_type as BagMatchType | undefined) ?? 'onzeker',
    is_doelobject_match: k.is_doelobject_match ?? false,
    match_kwaliteit: k.match_kwaliteit ?? 'onzeker',
    match_reden: k.match_reden ?? null,
  };
}

function hasSelectableId(k: BagMatchKandidaat): boolean {
  return !!(k.pdok_id || k.vbo_id || k.nummeraanduiding_id);
}

function isNearby(k: BagMatchKandidaat): boolean {
  return k.match_type === 'nabijgelegen_adres';
}

function isDoelobject(k: BagMatchKandidaat): boolean {
  return !!k.is_doelobject_match || k.match_type === 'exact_doelobject';
}

function badgeForKandidaat(k: BagMatchKandidaat): { label: string; tone: 'match' | 'pand' | 'nearby' | 'neutraal' } {
  if (isDoelobject(k)) return { label: 'MATCH · Doelobject', tone: 'match' };
  if (k.match_type === 'zelfde_huisnummer') return { label: 'Zelfde huisnummer', tone: 'pand' };
  if (k.match_type === 'zelfde_bag_pand') return { label: 'Zelfde BAG-pand', tone: 'pand' };
  if (k.match_type === 'nabijgelegen_adres') return { label: 'In de buurt', tone: 'nearby' };
  return { label: '', tone: 'neutraal' };
}

const TONE_CLASS: Record<string, string> = {
  match: 'bg-emerald-500/15 text-emerald-900 border-emerald-500/40 dark:bg-emerald-400/15 dark:text-emerald-100 dark:border-emerald-300/40',
  pand: 'bg-sky-500/10 text-sky-900 border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100 dark:border-sky-300/40',
  nearby: 'bg-muted text-muted-foreground border-border',
  neutraal: 'bg-muted text-muted-foreground border-border',
};

export default function BagMatchResolver({ signaalId, kandidaten }: Props) {
  const bag = useBagVerrijken();
  const [toonNearby, setToonNearby] = useState(false);

  const { primair, nearby } = useMemo(() => {
    const prim: BagMatchKandidaat[] = [];
    const near: BagMatchKandidaat[] = [];
    const raw = Array.isArray(kandidaten) ? kandidaten : [];
    for (const entry of raw) {
      const k = normalizeBagKandidaat(entry);
      if (!k) continue;
      if (isNearby(k)) near.push(k);
      else prim.push(k);
    }
    // Doelobject-match bovenaan.
    prim.sort((a, b) => Number(isDoelobject(b)) - Number(isDoelobject(a)));
    return { primair: prim, nearby: near };
  }, [kandidaten]);

  const kies = async (k: BagMatchKandidaat) => {
    try {
      await bag.mutateAsync({
        signaalId,
        force: true,
        selected_vbo_id: k.vbo_id ?? undefined,
        selected_nummeraanduiding_id: k.nummeraanduiding_id ?? undefined,
        selected_pdok_id: k.pdok_id ?? undefined,
      });
      toast.success('BAG-match gekozen en pandcontext opgehaald.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Match-selectie mislukt');
    }
  };

  const renderKandidaat = (k: BagMatchKandidaat, idx: number) => {
    const id = k.vbo_id ?? k.nummeraanduiding_id ?? k.pdok_id ?? String(idx);
    const badge = badgeForKandidaat(k);
    const doelobject = isDoelobject(k);
    const selectable = hasSelectableId(k);
    return (
      <li
        key={id}
        data-testid="bag-match-kandidaat"
        data-match-type={k.match_type ?? 'onbekend'}
        data-doelobject={doelobject ? 'true' : 'false'}
        className={`rounded-md border px-3 py-2 flex flex-wrap gap-3 items-start justify-between ${
          doelobject ? 'border-emerald-400/70 bg-emerald-50/60' : 'border-border bg-card'
        }`}
      >
        <div className="min-w-0 flex-1">
          {badge.label && (
            <span
              data-testid={doelobject ? 'bag-match-badge-doelobject' : 'bag-match-badge'}
              className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${TONE_CLASS[badge.tone]} mb-1`}
            >
              {badge.label}
            </span>
          )}
          <p className="text-sm text-foreground">{k.adres || '—'}</p>
          <p className="text-[11px] text-muted-foreground">
            {k.opp_m2 != null ? `${k.opp_m2} m²` : 'Oppervlakte onbekend'}
            {k.gebruiksdoel?.length ? ` · ${k.gebruiksdoel.join(', ')}` : ''}
            {k.status ? ` · ${k.status}` : ''}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono break-all">
            {k.vbo_id ? <>VBO {k.vbo_id}</> : null}
            {k.nummeraanduiding_id ? <> · NA {k.nummeraanduiding_id}</> : null}
            {k.match_kwaliteit ? ` · ${k.match_kwaliteit}` : ''}
          </p>
          {k.match_reden && (
            <p className="text-[10px] text-muted-foreground italic">{k.match_reden}</p>
          )}
          {!selectable && (
            <p
              data-testid="bag-match-onbruikbaar-melding"
              className="text-[11px] text-amber-900 italic mt-1"
            >
              Deze BAG-kandidaat mist een technisch ID. Controleer via BAG Viewer.
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="default"
            onClick={() => kies(k)}
            disabled={bag.isPending || !selectable}
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
            Mogelijke BAG-matches
          </p>
          <p className="text-xs text-amber-900/80">
            Kies het adres dat het beste bij het signaal hoort. Daarna wordt de BAG-pandcontext opgehaald.
          </p>
        </div>
      </div>

      <ul className="space-y-2" data-testid="bag-match-kandidaten">
        {primair.length === 0 ? (
          <li className="text-xs text-amber-900 italic">
            Geen exacte huisnummer-treffers gevonden — bekijk eventueel "Andere BAG-treffers in de buurt".
          </li>
        ) : (
          primair.map((k, i) => renderKandidaat(k, i))
        )}
      </ul>

      {nearby.length > 0 && (
        <div data-testid="bag-match-nearby-sectie" className="pt-1">
          <button
            type="button"
            onClick={() => setToonNearby((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-amber-900/80 hover:text-amber-900"
            data-testid="bag-match-nearby-toggle"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${toonNearby ? 'rotate-180' : ''}`} />
            {toonNearby ? 'Verberg' : 'Toon'} andere BAG-treffers in de buurt ({nearby.length})
          </button>
          {toonNearby && (
            <ul className="space-y-2 mt-2" data-testid="bag-match-nearby-lijst">
              {nearby.map((k, i) => renderKandidaat(k, i + 1000))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
