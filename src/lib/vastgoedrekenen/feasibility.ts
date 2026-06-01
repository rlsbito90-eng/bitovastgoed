// Feasibility-helpers: is een scenario "rond te rekenen" t.o.v. een referentiebedrag?
//
// Pure presentatielogica — gebruikt bestaande ComputedOutputs-velden en doet
// géén nieuwe rekenwerk. Bedoeld voor cockpit/ResultaatKaart/audit.
//
// Tolerantie voor "Bijna":
//   - maximaal 3% onder referentiebedrag, EN
//   - maximaal € 50.000 tekort
// Beide voorwaarden moeten gelden (strengste/veiligste interpretatie).
// Zo voorkomen we dat een ruim tekort in absolute zin (€ 200k op € 10M) als
// "bijna" telt enkel omdat het procentueel klein is, en omgekeerd.

export type FeasibilityStatus = 'ja' | 'bijna' | 'nee';

export const FEASIBILITY_NEAR_PCT = 0.03;
export const FEASIBILITY_NEAR_EUR = 50_000;

export type FeasibilityResult = {
  /** Status t.o.v. het referentiebedrag. */
  status: FeasibilityStatus;
  /** leadingMaxValue − reference (positief = ruimte, negatief = tekort). */
  diff: number;
  /** diff / reference * 100 (null als reference <= 0). */
  pct: number | null;
  /** Aanwezigheid van een bruikbaar referentiebedrag. */
  hasReference: boolean;
};

const STATUS_LABELS: Record<FeasibilityStatus, string> = {
  ja: 'Ja',
  bijna: 'Bijna',
  nee: 'Nee',
};

export function feasibilityLabel(status: FeasibilityStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Bepaalt of `leadingMaxValue` het `reference`-bedrag rond rekent.
 * - Ja  : leadingMaxValue >= reference
 * - Bijna: tekort ≤ 3% EN tekort ≤ € 50.000
 * - Nee : tekort groter dan beide drempels
 */
export function evaluateFeasibility(
  leadingMaxValue: number,
  reference: number | null | undefined,
): FeasibilityResult {
  const ref = Number(reference ?? 0);
  if (!(ref > 0)) {
    return { status: 'nee', diff: 0, pct: null, hasReference: false };
  }
  const diff = leadingMaxValue - ref;
  const pct = (diff / ref) * 100;
  if (diff >= 0) return { status: 'ja', diff, pct, hasReference: true };
  const tekort = -diff;
  const binnenPct = tekort <= ref * FEASIBILITY_NEAR_PCT;
  const binnenEur = tekort <= FEASIBILITY_NEAR_EUR;
  const status: FeasibilityStatus = binnenPct && binnenEur ? 'bijna' : 'nee';
  return { status, diff, pct, hasReference: true };
}

export const FEASIBILITY_TONE: Record<FeasibilityStatus, 'success' | 'warn' | 'danger'> = {
  ja: 'success',
  bijna: 'warn',
  nee: 'danger',
};
