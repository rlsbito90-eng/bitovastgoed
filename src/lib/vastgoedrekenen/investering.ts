// Aankoopkosten, totale investering, prijs per m².

import type { Scenario, ScenarioCost } from './types';
import { resolveEffectiveBuyerFee, resolveEffectiveNotary } from './fees/feeResolver';

export type AcquisitionBreakdown = {
  buyerFeeBase: number;
  buyerFeeVat: number;
  totalAcquisitionCosts: number; // excl. OVB en excl. aankoopprijs zelf
};

export function computeAcquisitionCosts(scenario: Scenario): AcquisitionBreakdown {
  const fee = resolveEffectiveBuyerFee(scenario);
  const notary = resolveEffectiveNotary(scenario);
  const buyerFeeBase = fee.amountExVat;
  const buyerFeeVat = fee.vatAmount;
  const totalAcquisitionCosts =
    buyerFeeBase + buyerFeeVat +
    notary.amount +
    Number(scenario.advisory_costs ?? 0) +
    Number(scenario.due_diligence_costs ?? 0) +
    Number(scenario.other_acquisition_costs ?? 0) +
    Number(scenario.safety_margin ?? 0);
  return { buyerFeeBase, buyerFeeVat, totalAcquisitionCosts };
}

/** Bereken effectief bedrag van een kostenpost (excl. btw): per_m2 × m2_basis óf totaalbedrag. */
export function effectiveCostAmount(c: ScenarioCost): number {
  const rec = c as unknown as Record<string, unknown>;
  const mode = (rec.calc_mode as string | null) ?? 'totaal';
  if (mode === 'per_m2') {
    const pm = Number(rec.amount_per_m2 ?? 0);
    const m2 = Number(rec.m2_basis ?? 0);
    if (pm > 0 && m2 > 0) return Math.round(pm * m2);
  }
  return Number(c.amount ?? 0);
}

export type VatTreatment = 'geen' | 'pct_21' | 'pct_9' | 'handmatig' | 'verrekenbaar';

/** Stabiele labels voor weergave + audit. */
export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  geen: 'Geen btw van toepassing',
  pct_21: 'Niet verrekenbaar — 21% meenemen',
  pct_9: 'Niet verrekenbaar — 9% meenemen',
  handmatig: 'Deels verrekenbaar — handmatig deel',
  verrekenbaar: 'Volledig verrekenbaar — excl. btw',
};

/**
 * Btw-bedrag per kostenpost dat als kosten meetelt in de totale investering.
 * Bij 'geen' / 'verrekenbaar' = 0 (informatieve btw zie computeCostBreakdown).
 */
export function effectiveCostVatAmount(c: ScenarioCost, unforeseenPct: number): number {
  const rec = c as unknown as Record<string, unknown>;
  const treatment = ((rec.vat_treatment as string | null) ?? 'geen') as VatTreatment;
  if (treatment === 'geen' || treatment === 'verrekenbaar') return 0;
  const base = effectiveCostAmount(c);
  const subtotal = base + Math.round((base * Number(unforeseenPct ?? 0)) / 100);
  if (treatment === 'handmatig') {
    const manual = rec.vat_amount_manual as number | null | undefined;
    if (manual != null && Number(manual) !== 0) return Number(manual);
    const pct = Number(rec.vat_percentage ?? 0);
    return Math.round((subtotal * pct) / 100);
  }
  const pct = treatment === 'pct_21' ? 21 : 9;
  return Math.round((subtotal * pct) / 100);
}

/**
 * Volledige opbouw per kostenpost. Btw wordt ALTIJD informatief berekend
 * (default 21% indien geen percentage gekozen), ongeacht de behandeling.
 * `includedInInvestment` reflecteert het bedrag dat daadwerkelijk meetelt.
 */
export interface CostBreakdown {
  treatment: VatTreatment;
  exVat: number;
  unforeseen: number;
  subtotalExVat: number;
  vatRate: number;
  vatAmountInformational: number;
  totalInclVat: number;
  vatAmountIncluded: number;
  includedInInvestment: number;
}

export function computeCostBreakdown(c: ScenarioCost, unforeseenPct: number): CostBreakdown {
  const rec = c as unknown as Record<string, unknown>;
  const treatment = ((rec.vat_treatment as string | null) ?? 'geen') as VatTreatment;
  const exVat = effectiveCostAmount(c);
  const unforeseen = Math.round((exVat * Number(unforeseenPct ?? 0)) / 100);
  const subtotalExVat = exVat + unforeseen;

  let vatRate = 21;
  if (treatment === 'pct_9') vatRate = 9;
  else if (treatment === 'handmatig') vatRate = Number(rec.vat_percentage ?? 21) || 21;
  else if (treatment === 'pct_21') vatRate = 21;
  else {
    const explicit = Number(rec.vat_percentage ?? 0);
    vatRate = explicit > 0 ? explicit : 21;
  }

  const vatAmountInformational = Math.round((subtotalExVat * vatRate) / 100);
  const totalInclVat = subtotalExVat + vatAmountInformational;
  const vatAmountIncluded = effectiveCostVatAmount(c, unforeseenPct);
  const includedInInvestment = subtotalExVat + vatAmountIncluded;

  return {
    treatment, exVat, unforeseen, subtotalExVat,
    vatRate, vatAmountInformational, totalInclVat,
    vatAmountIncluded, includedInInvestment,
  };
}

export function computeTotalCosts(
  costs: ScenarioCost[],
  unforeseenPct: number,
): {
  totalDirect: number;
  unforeseen: number;
  /** Subtotaal (alle posten + onvoorzien) excl. btw. */
  subtotalExVat: number;
  /** Totaal meegenomen btw over alle posten. */
  vatTotal: number;
  /** Totaal incl. onvoorzien en incl. btw — feed naar totale investering. */
  total: number;
} {
  const totalDirect = costs.reduce((s, c) => s + effectiveCostAmount(c), 0);
  const unforeseen = Math.round((totalDirect * Number(unforeseenPct ?? 0)) / 100);
  const subtotalExVat = totalDirect + unforeseen;
  const vatTotal = costs.reduce((s, c) => s + effectiveCostVatAmount(c, unforeseenPct), 0);
  return { totalDirect, unforeseen, subtotalExVat, vatTotal, total: subtotalExVat + vatTotal };
}


export function computeTotalInvestment(args: {
  purchasePrice: number;
  totalTransferTax: number;
  totalAcquisitionCosts: number;
  totalCosts: number;
  financingCosts: number;
}): number {
  return args.purchasePrice + args.totalTransferTax + args.totalAcquisitionCosts + args.totalCosts + args.financingCosts;
}

export function pricePerM2(price: number, m2: number | null | undefined): number | null {
  if (!m2 || m2 <= 0) return null;
  return Math.round(price / m2);
}
