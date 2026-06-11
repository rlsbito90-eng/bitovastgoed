import type { OffMarketSignaal } from '@/lib/offMarket/types';

export type DatumBucket = 'actueel' | 'komend' | 'historisch' | 'alles';

export const DATUMBUCKET_LABEL: Record<DatumBucket, string> = {
  actueel: 'Actueel',
  komend: 'Komend',
  historisch: 'Historisch',
  alles: 'Alles',
};

const HISTORISCHE_STATUSSEN = new Set(['archief', 'afgevallen', 'niet_interessant']);

function asDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isHistorisch(s: OffMarketSignaal, now = new Date()): boolean {
  if (s.gearchiveerd_op) return true;
  if (HISTORISCHE_STATUSSEN.has(s.status as string)) return true;
  const bron = asDate(s.bron_datum as unknown as string);
  if (bron && now.getTime() - bron.getTime() > 180 * 24 * 3600 * 1000) return true;
  return false;
}

export function isKomend(s: OffMarketSignaal, now = new Date()): boolean {
  if (isHistorisch(s, now)) return false;
  const va = asDate(s.volgende_actie_datum as unknown as string);
  if (va && va.getTime() > now.getTime()) return true;
  const bron = asDate(s.bron_datum as unknown as string);
  if (bron && bron.getTime() > now.getTime()) return true;
  return false;
}

export function isActueel(s: OffMarketSignaal, now = new Date()): boolean {
  if (isHistorisch(s, now)) return false;
  if (isKomend(s, now)) return false;
  if (HISTORISCHE_STATUSSEN.has(s.status as string)) return false;
  if (s.gearchiveerd_op) return false;
  const bron = asDate(s.bron_datum as unknown as string);
  if (!bron) return true; // geen datum → behandel als actueel
  const dagen = (now.getTime() - bron.getTime()) / (24 * 3600 * 1000);
  return dagen <= 90 && dagen >= 0;
}

export function matchBucket(s: OffMarketSignaal, bucket: DatumBucket, now = new Date()): boolean {
  switch (bucket) {
    case 'alles': return true;
    case 'actueel': return isActueel(s, now);
    case 'komend': return isKomend(s, now);
    case 'historisch': return isHistorisch(s, now);
  }
}
