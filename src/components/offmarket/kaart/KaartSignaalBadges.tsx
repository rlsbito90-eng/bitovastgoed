// V29 — Compacte AI- en BAG-/Kadasteradviesbadges voor kaartpopup en sidepanel.
// Pure presentatie. Leest uitsluitend scalaire velden — geen bag_vbos,
// bag_match_kandidaten of ai_score_componenten.
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { Kadasteradvies } from '@/lib/offMarket/bag/types';
import KadasteradviesBadge from '@/components/offmarket/bag/KadasteradviesBadge';
import { formatNumberNL } from '@/lib/format/nl';

/** Subset van OffMarketSignaal die deze badges écht nodig hebben. */
export type SignaalKaartBadgeData = Pick<
  OffMarketSignaal,
  | 'ai_score'
  | 'ai_status'
  | 'bag_status'
  | 'kadasteradvies'
  | 'bag_geselecteerd_opp_m2'
  | 'bag_pandcontext_totaal_opp_m2'
  | 'bag_totaal_oppervlakte_m2'
  | 'bag_pandcontext_aantal_vbo'
  | 'bag_aantal_vbo'
  | 'bag_bouwjaar'
  | 'bag_pandcontext_bron'
>;

type Size = 'sm' | 'md';

const KADASTERADVIES_WAARDEN: ReadonlySet<Kadasteradvies> = new Set<Kadasteradvies>([
  'laag', 'voorzichtig', 'aanbevolen', 'sterk_aanbevolen',
]);

function isKadasteradvies(v: string | null | undefined): v is Kadasteradvies {
  return typeof v === 'string' && KADASTERADVIES_WAARDEN.has(v as Kadasteradvies);
}

/* ------------------------- AI-score badge ------------------------- */

interface AiScoreBadgeProps {
  score: number | null | undefined;
  status?: OffMarketSignaal['ai_status'] | null;
  size?: Size;
  className?: string;
}

function aiTone(score: number): 'emerald' | 'amber' | 'muted' {
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'amber';
  return 'muted';
}

const AI_TONE_CLS: Record<'emerald' | 'amber' | 'muted' | 'empty', string> = {
  emerald: 'bg-success/10 text-success border-success/30',
  amber: 'bg-warning/10 text-warning border-warning/30',
  muted: 'bg-muted/60 text-muted-foreground border-border',
  empty: 'bg-transparent text-muted-foreground border-border/60',
};

export function AiScoreBadge({ score, size = 'md', className = '' }: AiScoreBadgeProps) {
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  const heeftScore = typeof score === 'number' && Number.isFinite(score);
  const tone = heeftScore ? aiTone(score) : 'empty';
  const label = heeftScore ? `AI ${Math.round(score)}` : 'AI niet verrijkt';
  return (
    <span
      data-testid="ai-score-badge"
      data-ai-tone={tone}
      className={`inline-flex items-center font-medium border rounded-full whitespace-nowrap ${sizing} ${AI_TONE_CLS[tone]} ${className}`}
    >
      {label}
    </span>
  );
}

/* --------------------------- BAG badge --------------------------- */

interface BagKaartBadgeProps {
  signaal: Pick<SignaalKaartBadgeData, 'bag_status' | 'kadasteradvies'>;
  size?: Size;
  className?: string;
}

const BAG_STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  meerdere_matches: { label: 'BAG-keuze nodig', cls: 'bg-warning/10 text-warning border-warning/30' },
  geen_match: { label: 'Geen BAG-match', cls: 'bg-muted/60 text-muted-foreground border-border' },
  fout: { label: 'BAG-fout', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  niet_verrijkt: { label: 'BAG niet verrijkt', cls: 'bg-transparent text-muted-foreground border-border/60' },
  bezig: { label: 'BAG bezig…', cls: 'bg-muted/60 text-muted-foreground border-border' },
  verrijkt_geen_advies: { label: 'BAG verrijkt', cls: 'bg-success/10 text-success border-success/30' },
};

export function BagKaartBadge({ signaal, size = 'md', className = '' }: BagKaartBadgeProps) {
  const status = signaal.bag_status ?? 'niet_verrijkt';
  const advies = signaal.kadasteradvies;

  if (status === 'verrijkt') {
    if (isKadasteradvies(advies)) {
      return <KadasteradviesBadge niveau={advies} size={size} className={className} />;
    }
    const chip = BAG_STATUS_CHIP.verrijkt_geen_advies;
    const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
    return (
      <span
        data-testid="bag-kaart-badge"
        data-bag-status="verrijkt"
        className={`inline-flex items-center font-medium border rounded-full whitespace-nowrap ${sizing} ${chip.cls} ${className}`}
      >
        {chip.label}
      </span>
    );
  }

  const chip = BAG_STATUS_CHIP[status] ?? BAG_STATUS_CHIP.niet_verrijkt;
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5';
  return (
    <span
      data-testid="bag-kaart-badge"
      data-bag-status={status}
      className={`inline-flex items-center font-medium border rounded-full whitespace-nowrap ${sizing} ${chip.cls} ${className}`}
    >
      {chip.label}
    </span>
  );
}

/* ----------------------- Popup-detailregel ----------------------- */

const CONTEXTBRON_LABEL: Record<string, string> = {
  pandid: 'BAG-pand',
  huisnummer: 'Huisnummercontext',
  gemengd: 'Gemengde BAG-context',
};

function fmtM2(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return `${formatNumberNL(Number(n), 0)} m²`;
}

interface BagPopupDetailRegelProps {
  signaal: Pick<
    SignaalKaartBadgeData,
    | 'bag_status'
    | 'bag_geselecteerd_opp_m2'
    | 'bag_pandcontext_totaal_opp_m2'
    | 'bag_totaal_oppervlakte_m2'
    | 'bag_pandcontext_aantal_vbo'
    | 'bag_aantal_vbo'
    | 'bag_bouwjaar'
    | 'bag_pandcontext_bron'
  >;
  className?: string;
}

export function BagPopupDetailRegel({ signaal, className = '' }: BagPopupDetailRegelProps) {
  if (signaal.bag_status !== 'verrijkt') return null;

  const doel = fmtM2(signaal.bag_geselecteerd_opp_m2);
  const contextOpp = fmtM2(signaal.bag_pandcontext_totaal_opp_m2 ?? signaal.bag_totaal_oppervlakte_m2);
  const vboAantal = signaal.bag_pandcontext_aantal_vbo ?? signaal.bag_aantal_vbo;
  const vbo = typeof vboAantal === 'number' && Number.isFinite(vboAantal) && vboAantal > 0
    ? `${vboAantal} VBO${vboAantal === 1 ? '' : "'s"}`
    : null;
  const bouwjaar = typeof signaal.bag_bouwjaar === 'number' && Number.isFinite(signaal.bag_bouwjaar)
    ? String(signaal.bag_bouwjaar)
    : null;

  const segments = [
    doel,
    contextOpp && contextOpp !== doel ? `${contextOpp} totaal` : null,
    vbo,
    bouwjaar,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);

  const bronKey = signaal.bag_pandcontext_bron;
  const bronLabel = typeof bronKey === 'string' ? CONTEXTBRON_LABEL[bronKey] ?? null : null;

  if (segments.length === 0 && !bronLabel) return null;

  return (
    <div data-testid="bag-popup-detail" className={`text-[11px] text-muted-foreground leading-snug ${className}`}>
      {segments.length > 0 && (
        <div data-testid="bag-popup-detail-cijfers" className="break-words">{segments.join(' · ')}</div>
      )}
      {bronLabel && (
        <div data-testid="bag-popup-detail-bron" className="break-words">{bronLabel}</div>
      )}
    </div>
  );
}
