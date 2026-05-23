// src/lib/derivations/verhuur.ts
//
// Pure helpers voor verhuur-/huurder-metrics.
//
// Regels:
//   - Huurder-rijen zijn leidend wanneer aanwezig (≥1 rij).
//   - Bij geen huurder-rijen valt de helper terug op objectniveau-velden
//     (`object.aantalHuurders`, `object.huurinkomsten`, `object.leegstandPct`).
//   - Mismatches (object versus som huurders) zijn SOFT warnings, geen blocker.
//   - WALT/WALB zijn huur-gewogen op basis van `einddatum` per huurder.
//   - Geen UI-dependencies.

import { safeNumber } from './financial';

// ── Minimal interfaces (decoupled van mock-data) ────────────────────────────

export interface VerhuurObjectLike {
  aantalHuurders?: number;
  /** Objectniveau-jaarhuur. Heet in `mock-data.ts` `huurinkomsten`. */
  huurinkomsten?: number;
  leegstandPct?: number;
}

export interface VerhuurHuurderLike {
  jaarhuur?: number;
  oppervlakteM2?: number;
  /** ISO date string. */
  ingangsdatum?: string;
  /** ISO date string. */
  einddatum?: string;
  /** ISO date string — eerste opzegmoment indien beschikbaar (voor WALB). */
  eersteOpzegmoment?: string;
}

// ── Mismatch-tolerantie ─────────────────────────────────────────────────────

/** Relatieve drempel voor "huurverschil" tussen objecthuur en som huurders. */
export const RENT_MISMATCH_THRESHOLD = 0.01; // 1%

// ── Resultaat-types ─────────────────────────────────────────────────────────

export type VerhuurSource = 'huurders' | 'object' | 'none';

export interface VerhuurMetrics {
  aantalHuurders: number | null;
  totaleJaarhuur: number | null;
  verhuurdeM2: number | null;
  leegstandPct: number | null;
  /** Huur-gewogen Weighted Average Lease Term (jaren, tot `einddatum`). */
  waltJaren: number | null;
  /** Huur-gewogen Weighted Average Lease Break (jaren, tot `eersteOpzegmoment` of `einddatum`). */
  walbJaren: number | null;
  /** Bron van aantal + jaarhuur. */
  source: VerhuurSource;
  /** Soft mismatch-signalen. */
  warnings: {
    rentMismatch: boolean;
    tenantCountMismatch: boolean;
  };
  /** Detailgegevens (voor banners en tooltips). */
  detail: {
    sumTenantRent: number | null;
    objectRent: number | null;
    rentDeltaAbs: number | null;
    rentDeltaPct: number | null;
    tenantsCount: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

function yearsFromTodayUntil(iso: string | undefined, today = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = daysBetween(today, d);
  if (days <= 0) return 0;
  return days / 365.25;
}

/**
 * Huur-gewogen gemiddelde resterende looptijd in jaren.
 * Returnt `null` als onvoldoende data (geen huurders met einddatum + jaarhuur).
 */
function weightedAverageYears(
  huurders: VerhuurHuurderLike[],
  endIsoSelector: (h: VerhuurHuurderLike) => string | undefined,
  today = new Date(),
): number | null {
  let weightSum = 0;
  let weighted = 0;
  for (const h of huurders) {
    const rent = safeNumber(h.jaarhuur);
    const years = yearsFromTodayUntil(endIsoSelector(h), today);
    if (rent === null || rent <= 0 || years === null) continue;
    weightSum += rent;
    weighted += rent * years;
  }
  if (weightSum <= 0) return null;
  return weighted / weightSum;
}

// ── Hoofdfunctie ────────────────────────────────────────────────────────────

export function deriveVerhuurMetrics(
  object: VerhuurObjectLike | null | undefined,
  huurders: VerhuurHuurderLike[] | null | undefined,
  options: { today?: Date } = {},
): VerhuurMetrics {
  const today = options.today ?? new Date();
  const rows = Array.isArray(huurders) ? huurders : [];
  const hasRows = rows.length > 0;

  const objectRent = safeNumber(object?.huurinkomsten);
  const objectCount = safeNumber(object?.aantalHuurders);
  const objectLeegstand = safeNumber(object?.leegstandPct);

  // Som per huurder (rent, m²) — alleen waar numeriek > 0.
  let sumRent = 0;
  let hasAnyRent = false;
  let sumM2 = 0;
  let hasAnyM2 = false;
  for (const h of rows) {
    const r = safeNumber(h.jaarhuur);
    if (r !== null && r > 0) { sumRent += r; hasAnyRent = true; }
    const m = safeNumber(h.oppervlakteM2);
    if (m !== null && m > 0) { sumM2 += m; hasAnyM2 = true; }
  }

  // Bron-selectie
  const useTenantRows = hasRows;
  const source: VerhuurSource = useTenantRows ? 'huurders' : (objectRent !== null || objectCount !== null) ? 'object' : 'none';

  const aantalHuurders = useTenantRows
    ? rows.length
    : (objectCount !== null ? Math.max(0, Math.round(objectCount)) : null);

  const totaleJaarhuur = useTenantRows
    ? (hasAnyRent ? sumRent : objectRent) // fallback naar object als huurders geen bedragen hebben
    : objectRent;

  const verhuurdeM2 = useTenantRows && hasAnyM2 ? sumM2 : null;

  // WALT/WALB huur-gewogen
  const waltJaren = useTenantRows ? weightedAverageYears(rows, (h) => h.einddatum, today) : null;
  const walbJaren = useTenantRows
    ? weightedAverageYears(rows, (h) => h.eersteOpzegmoment ?? h.einddatum, today)
    : null;

  // Mismatch-detectie (alleen zinvol als beide bronnen aanwezig zijn)
  const tenantCountMismatch =
    useTenantRows && objectCount !== null && Math.round(objectCount) !== rows.length;

  let rentDeltaAbs: number | null = null;
  let rentDeltaPct: number | null = null;
  let rentMismatch = false;
  if (useTenantRows && hasAnyRent && objectRent !== null && objectRent > 0) {
    rentDeltaAbs = sumRent - objectRent;
    rentDeltaPct = rentDeltaAbs / objectRent;
    rentMismatch = Math.abs(rentDeltaPct) > RENT_MISMATCH_THRESHOLD;
  }

  return {
    aantalHuurders,
    totaleJaarhuur,
    verhuurdeM2,
    leegstandPct: objectLeegstand,
    waltJaren,
    walbJaren,
    source,
    warnings: { rentMismatch, tenantCountMismatch },
    detail: {
      sumTenantRent: hasAnyRent ? sumRent : null,
      objectRent,
      rentDeltaAbs,
      rentDeltaPct,
      tenantsCount: rows.length,
    },
  };
}

// ── Losse mismatch-helpers (handig voor banners zonder volledige derive) ────

export function hasRentMismatch(
  object: VerhuurObjectLike | null | undefined,
  huurders: VerhuurHuurderLike[] | null | undefined,
): boolean {
  return deriveVerhuurMetrics(object, huurders).warnings.rentMismatch;
}

export function hasTenantCountMismatch(
  object: VerhuurObjectLike | null | undefined,
  huurders: VerhuurHuurderLike[] | null | undefined,
): boolean {
  return deriveVerhuurMetrics(object, huurders).warnings.tenantCountMismatch;
}
