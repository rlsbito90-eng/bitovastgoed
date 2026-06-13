// Funnel-mapping voor de Acquisitie-module (V1).
// Bron-agnostisch ontworpen, maar in V1 alleen Off-Market signalen aangesloten.
// Pure functies + aggregaten zodat alles testbaar is.

import type { OffMarketSignaal, OffMarketStatus, OffMarketEigenaarstatus } from '@/lib/offMarket/types';

// ---------- Funnelstappen ----------
export type FunnelStage =
  | 'signaal'
  | 'interessant'
  | 'te_onderzoeken'
  | 'eigenaar_achterhalen'
  | 'eigenaar_gevonden'
  | 'benaderd'
  | 'reactie'
  | 'in_gesprek'
  | 'aanbod'
  | 'dealtraject'
  | 'transactie';

export const FUNNEL_STAGES: FunnelStage[] = [
  'signaal',
  'interessant',
  'te_onderzoeken',
  'eigenaar_achterhalen',
  'eigenaar_gevonden',
  'benaderd',
  'reactie',
  'in_gesprek',
  'aanbod',
  'dealtraject',
  'transactie',
];

export const FUNNEL_STAGE_LABEL: Record<FunnelStage, string> = {
  signaal: 'Signaal / lead binnen',
  interessant: 'Interessant',
  te_onderzoeken: 'Te onderzoeken',
  eigenaar_achterhalen: 'Eigenaar achterhalen',
  eigenaar_gevonden: 'Eigenaar gevonden',
  benaderd: 'Benaderd',
  reactie: 'Reactie ontvangen',
  in_gesprek: 'In gesprek',
  aanbod: 'Aanbod / verkoopkans',
  dealtraject: 'Dealtraject',
  transactie: 'Transactie',
};

export const FUNNEL_STAGE_KORT: Record<FunnelStage, string> = {
  signaal: 'Signaal',
  interessant: 'Interessant',
  te_onderzoeken: 'Onderzoek',
  eigenaar_achterhalen: 'Eig. achterhalen',
  eigenaar_gevonden: 'Eig. gevonden',
  benaderd: 'Benaderd',
  reactie: 'Reactie',
  in_gesprek: 'Gesprek',
  aanbod: 'Aanbod',
  dealtraject: 'Dealtraject',
  transactie: 'Transactie',
};

export const stageRank = (stage: FunnelStage): number => FUNNEL_STAGES.indexOf(stage);

// ---------- Acquisitiebron ----------
// V1: alleen 'off_market_radar' wordt automatisch gevuld. Andere bronnen blijven
// 0 tot V1.5 (acquisitie_leads tabel) er is.
export type AcquisitieBron =
  | 'off_market_radar'
  | 'facebook_ads'
  | 'website'
  | 'netwerk'
  | 'bestaande_relatie'
  | 'inkomend_telefoon'
  | 'linkedin'
  | 'handmatige_acquisitie'
  | 'referral'
  | 'makelaar_collega'
  | 'anders';

export const ACQUISITIE_BRON_LABEL: Record<AcquisitieBron, string> = {
  off_market_radar: 'Off-Market Radar',
  facebook_ads: 'Facebook Ads',
  website: 'Website',
  netwerk: 'Netwerk',
  bestaande_relatie: 'Bestaande relatie',
  inkomend_telefoon: 'Inkomend telefoon',
  linkedin: 'LinkedIn',
  handmatige_acquisitie: 'Handmatige acquisitie',
  referral: 'Referral',
  makelaar_collega: 'Makelaar / collega',
  anders: 'Anders',
};

// ---------- Status → highwater stage mapping (Off-Market) ----------
// Een signaal "bereikt" een stage als zijn status ≥ die stage zit.
// Afgevallen / niet_interessant / archief → aparte bucket, niet in funnel.
const STATUS_NAAR_STAGE: Partial<Record<OffMarketStatus, FunnelStage>> = {
  nieuw_signaal: 'signaal',
  twijfel: 'signaal',
  interessant: 'interessant',
  te_onderzoeken: 'te_onderzoeken',
  eigenaar_achterhalen: 'eigenaar_achterhalen',
  eigenaar_gevonden: 'eigenaar_gevonden',
  benaderen: 'eigenaar_gevonden',
  benaderd: 'benaderd',
  in_gesprek: 'in_gesprek',
  aanbod_ontvangen: 'aanbod',
  object_ontvangen: 'dealtraject',
  dealtraject: 'dealtraject',
};

const EIGENAARSTATUS_NAAR_STAGE: Partial<Record<OffMarketEigenaarstatus, FunnelStage>> = {
  te_onderzoeken: 'eigenaar_achterhalen',
  gevonden: 'eigenaar_gevonden',
  benaderd: 'benaderd',
  in_gesprek: 'in_gesprek',
};

const AFVAL_STATUSSEN = new Set<OffMarketStatus>(['niet_interessant', 'afgevallen', 'archief']);

/** Bepaal de hoogst bereikte funnelstap voor één Off-Market signaal. Null = afgevallen. */
export function bepaalFunnelStap(signaal: OffMarketSignaal): FunnelStage | null {
  if (signaal.gearchiveerd_op || AFVAL_STATUSSEN.has(signaal.status)) return null;

  let beste: FunnelStage = 'signaal';
  const fromStatus = STATUS_NAAR_STAGE[signaal.status];
  if (fromStatus && stageRank(fromStatus) > stageRank(beste)) beste = fromStatus;

  const eigStatus = signaal.eigenaarstatus as OffMarketEigenaarstatus | null | undefined;
  if (eigStatus) {
    const fromEig = EIGENAARSTATUS_NAAR_STAGE[eigStatus];
    if (fromEig && stageRank(fromEig) > stageRank(beste)) beste = fromEig;
  }

  // In_gesprek impliceert reactie ontvangen.
  // (Reactie zelf heeft geen eigen status in het off-market enum; afgeleid.)
  // Geen verdere actie nodig — stageRank('in_gesprek') > stageRank('reactie').

  // Aanbod: indien een bieding gekoppeld is via biedingen-tabel, gebeurt dat in V3.
  // Transactie: gekoppelde deal afgerond → V3.

  return beste;
}

/** Returnt of signaal in de "afgevallen" bucket valt. */
export function isAfgevallen(signaal: OffMarketSignaal): boolean {
  return !!signaal.gearchiveerd_op || AFVAL_STATUSSEN.has(signaal.status);
}

// ---------- Filters ----------
export interface FunnelFilters {
  periodeVan?: string | null;   // ISO datum (created_at >=)
  periodeTot?: string | null;   // ISO datum (created_at <=)
  bron?: AcquisitieBron | null;
  gemeente?: string | null;     // case-insensitive contains op plaats
  status?: OffMarketStatus | null;
}

/**
 * Bron-helper. V1: alle Off-Market signalen tellen als 'off_market_radar'.
 * Later vervangen door s.acquisitie_bron-veld op het record.
 */
export function bronVanSignaal(_signaal: OffMarketSignaal): AcquisitieBron {
  return 'off_market_radar';
}

export function filterSignalen(signalen: OffMarketSignaal[], f: FunnelFilters): OffMarketSignaal[] {
  const van = f.periodeVan ? new Date(f.periodeVan).getTime() : null;
  const tot = f.periodeTot ? new Date(f.periodeTot).getTime() : null;
  const gem = f.gemeente?.trim().toLowerCase() || null;
  return signalen.filter(s => {
    if (van !== null) {
      const t = new Date(s.created_at).getTime();
      if (isNaN(t) || t < van) return false;
    }
    if (tot !== null) {
      const t = new Date(s.created_at).getTime();
      if (isNaN(t) || t > tot) return false;
    }
    if (f.bron && bronVanSignaal(s) !== f.bron) return false;
    if (f.status && s.status !== f.status) return false;
    if (gem) {
      const plaats = (s.plaats ?? '').toLowerCase();
      if (!plaats.includes(gem)) return false;
    }
    return true;
  });
}

// ---------- Aggregaten ----------
export interface FunnelStapResultaat {
  stage: FunnelStage;
  label: string;
  aantal: number;
  conversiePrev: number | null;     // 0..1
  conversieInstroom: number | null; // 0..1
}

export interface FunnelAggregaat {
  totaalActief: number;
  totaalAfgevallen: number;
  stappen: FunnelStapResultaat[];
}

/** Bereken funnel-aggregaat: per stage het aantal signalen dat die stap minimaal heeft bereikt. */
export function berekenFunnelAggregaat(signalen: OffMarketSignaal[]): FunnelAggregaat {
  const counts: Record<FunnelStage, number> = {
    signaal: 0, interessant: 0, te_onderzoeken: 0,
    eigenaar_achterhalen: 0, eigenaar_gevonden: 0, benaderd: 0,
    reactie: 0, in_gesprek: 0, aanbod: 0, dealtraject: 0, transactie: 0,
  };
  let afgevallen = 0;
  let actief = 0;

  for (const s of signalen) {
    if (isAfgevallen(s)) { afgevallen += 1; continue; }
    const stap = bepaalFunnelStap(s);
    if (!stap) { afgevallen += 1; continue; }
    actief += 1;
    const rank = stageRank(stap);
    for (let i = 0; i <= rank; i += 1) {
      counts[FUNNEL_STAGES[i]] += 1;
    }
  }

  const instroom = counts.signaal;
  const stappen: FunnelStapResultaat[] = FUNNEL_STAGES.map((stage, i) => {
    const aantal = counts[stage];
    const prev = i === 0 ? null : counts[FUNNEL_STAGES[i - 1]];
    return {
      stage,
      label: FUNNEL_STAGE_LABEL[stage],
      aantal,
      conversiePrev: prev === null ? null : (prev > 0 ? aantal / prev : null),
      conversieInstroom: i === 0 ? null : (instroom > 0 ? aantal / instroom : null),
    };
  });

  return { totaalActief: actief, totaalAfgevallen: afgevallen, stappen };
}

/** Bron × stage kruistabel (V1 enkel Off-Market Radar gevuld). */
export function berekenBronAggregaat(signalen: OffMarketSignaal[]): Array<{
  bron: AcquisitieBron;
  label: string;
  totaal: number;
  perStage: Record<FunnelStage, number>;
}> {
  const perBron = new Map<AcquisitieBron, { totaal: number; perStage: Record<FunnelStage, number> }>();
  for (const s of signalen) {
    if (isAfgevallen(s)) continue;
    const stap = bepaalFunnelStap(s);
    if (!stap) continue;
    const bron = bronVanSignaal(s);
    let entry = perBron.get(bron);
    if (!entry) {
      entry = {
        totaal: 0,
        perStage: {
          signaal: 0, interessant: 0, te_onderzoeken: 0,
          eigenaar_achterhalen: 0, eigenaar_gevonden: 0, benaderd: 0,
          reactie: 0, in_gesprek: 0, aanbod: 0, dealtraject: 0, transactie: 0,
        },
      };
      perBron.set(bron, entry);
    }
    entry.totaal += 1;
    const rank = stageRank(stap);
    for (let i = 0; i <= rank; i += 1) {
      entry.perStage[FUNNEL_STAGES[i]] += 1;
    }
  }
  return Array.from(perBron.entries())
    .map(([bron, v]) => ({ bron, label: ACQUISITIE_BRON_LABEL[bron], ...v }))
    .sort((a, b) => b.totaal - a.totaal);
}

/** Signalen die op dit moment een specifieke stage als highwater hebben (voor de drill-down lijst). */
export function signalenOpStage(signalen: OffMarketSignaal[], stage: FunnelStage | 'afgevallen'): OffMarketSignaal[] {
  if (stage === 'afgevallen') return signalen.filter(isAfgevallen);
  return signalen.filter(s => bepaalFunnelStap(s) === stage);
}

/** Signalen die een stage minimaal bereikt hebben (voor klikbaar filter op de funnel). */
export function signalenDieStageBereikten(
  signalen: OffMarketSignaal[],
  stage: FunnelStage,
): OffMarketSignaal[] {
  const minRank = stageRank(stage);
  return signalen.filter(s => {
    const stap = bepaalFunnelStap(s);
    return stap !== null && stageRank(stap) >= minRank;
  });
}

// ---------- Formatters ----------
export function fmtPct(v: number | null): string {
  if (v === null || !isFinite(v)) return '—';
  return `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`;
}
