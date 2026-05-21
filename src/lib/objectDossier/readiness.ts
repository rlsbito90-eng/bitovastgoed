// Verkoopgereedheid-score op basis van checklist-items.
// Robuust voor objecten zonder dossierdata.

import { CHECKLIST_CATALOG, type CatalogItem, type DossierStatus } from './catalog';

export type ReadinessLabel =
  | 'niet_gereed'
  | 'summier_dossier'
  | 'teaser_gereed'
  | 'pakket_gedeeltelijk'
  | 'verkoopklaar'
  | 'dd_gereed';

export const READINESS_LABELS: Record<ReadinessLabel, string> = {
  niet_gereed:          'Niet gereed',
  summier_dossier:      'Summier dossier',
  teaser_gereed:        'Teaser-gereed',
  pakket_gedeeltelijk:  'Informatiepakket gedeeltelijk',
  verkoopklaar:         'Verkoopklaar',
  dd_gereed:            'DD-gereed',
};

export const READINESS_TONE: Record<ReadinessLabel, 'crimson' | 'amber' | 'gold' | 'sand' | 'emerald'> = {
  niet_gereed:         'crimson',
  summier_dossier:     'crimson',
  teaser_gereed:       'gold',
  pakket_gedeeltelijk: 'amber',
  verkoopklaar:        'emerald',
  dd_gereed:           'emerald',
};

export interface EffectiveItem {
  catalog: CatalogItem;
  status: DossierStatus | null;
  fromAuto: boolean;
}

function statusFactor(status: DossierStatus | null): number | null {
  // null = telt als 0 maar wel meegerekend; nvt = uitgesloten
  switch (status) {
    case 'aanwezig':         return 1;
    case 'opgevraagd':       return 0.5;
    case 'te_controleren':   return 0.5;
    case 'ontbreekt':        return 0;
    case 'niet_beschikbaar': return 0;
    case 'nvt':              return null;
    default:                 return 0;
  }
}

export interface ReadinessResult {
  score: number;                          // 0-100
  label: ReadinessLabel;
  missingCritical: EffectiveItem[];       // weight 3, niet aanwezig
  teaserKlaar: boolean;
  totalCounted: number;
  totalAchieved: number;
}

export function computeReadiness(items: EffectiveItem[]): ReadinessResult {
  let weightSum = 0;
  let scoreSum = 0;
  const missingCritical: EffectiveItem[] = [];
  let teaserKlaar = false;
  let juridischCriticalAllOk = true;

  for (const it of items) {
    const f = statusFactor(it.status);
    if (f === null) continue; // nvt
    weightSum += it.catalog.weight;
    scoreSum += it.catalog.weight * f;

    if (it.catalog.weight === 3 && it.status !== 'aanwezig') {
      missingCritical.push(it);
      if (it.catalog.category === 'juridisch') juridischCriticalAllOk = false;
    }
    if (it.catalog.key === 'teaser_klaar' && it.status === 'aanwezig') teaserKlaar = true;
  }

  const score = weightSum > 0 ? Math.round((scoreSum / weightSum) * 100) : 0;

  let label: ReadinessLabel = 'niet_gereed';
  if (score >= 90 && juridischCriticalAllOk) label = 'dd_gereed';
  else if (score >= 80) label = 'verkoopklaar';
  else if (score >= 60) label = 'pakket_gedeeltelijk';
  else if (score >= 40 && teaserKlaar) label = 'teaser_gereed';
  else if (score >= 20) label = 'summier_dossier';

  return {
    score,
    label,
    missingCritical,
    teaserKlaar,
    totalCounted: weightSum,
    totalAchieved: Math.round(scoreSum),
  };
}

/**
 * Bouw effectieve items door catalogus, opgeslagen rijen en object-velden samen te voegen.
 */
export function buildEffectiveItems(
  storedByKey: Record<string, { status: DossierStatus | null }>,
  objectRecord: Record<string, unknown> | null | undefined,
): EffectiveItem[] {
  return CHECKLIST_CATALOG.map(catalog => {
    const stored = storedByKey[catalog.key];
    if (stored && stored.status) {
      return { catalog, status: stored.status, fromAuto: false };
    }
    if (catalog.autoFromObjectField && objectRecord) {
      const v = objectRecord[catalog.autoFromObjectField];
      const hasValue = v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v));
      if (hasValue) return { catalog, status: 'aanwezig' as DossierStatus, fromAuto: true };
    }
    return { catalog, status: stored?.status ?? null, fromAuto: false };
  });
}
