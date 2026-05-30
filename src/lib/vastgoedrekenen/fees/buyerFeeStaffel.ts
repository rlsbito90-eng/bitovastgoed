// Bito Vastgoed aankoopfee-staffel (quickscan-default).
//
// Schijven zonder overlap:
//   - basis t/m € 1.000.000           → 2,0% ex. btw
//   - basis € 1.000.001 – € 3.000.000 → 1,5% ex. btw
//   - basis vanaf € 3.000.001         → 1,0% ex. btw
//
// Pure functions, geen side effects. Schrijft niet naar de DB.

import type { Scenario } from '../types';

export type BuyerFeeTier = {
  /** Inclusieve onderkant van de schijf in euro's. */
  minInclusive: number;
  /** Inclusieve bovenkant van de schijf in euro's (null = oneindig). */
  maxInclusive: number | null;
  /** Percentage ex. btw. */
  pctExVat: number;
  /** Korte labeltekst voor UI/audit. */
  label: string;
};

export const BITO_BUYER_FEE_TIERS: BuyerFeeTier[] = [
  { minInclusive: 0, maxInclusive: 1_000_000, pctExVat: 2.0, label: 't/m € 1.000.000 — 2,0%' },
  { minInclusive: 1_000_001, maxInclusive: 3_000_000, pctExVat: 1.5, label: '€ 1.000.001 – € 3.000.000 — 1,5%' },
  { minInclusive: 3_000_001, maxInclusive: null, pctExVat: 1.0, label: 'vanaf € 3.000.001 — 1,0%' },
];

export const DEFAULT_BUYER_FEE_VAT_PCT = 21;

export function selectBuyerFeeTier(basis: number): BuyerFeeTier {
  const b = Math.max(0, Math.round(Number(basis ?? 0)));
  for (const t of BITO_BUYER_FEE_TIERS) {
    const okMin = b >= t.minInclusive;
    const okMax = t.maxInclusive == null || b <= t.maxInclusive;
    if (okMin && okMax) return t;
  }
  return BITO_BUYER_FEE_TIERS[BITO_BUYER_FEE_TIERS.length - 1];
}

export type BuyerFeeBasisSource = 'beoogde_aankoopprijs' | 'vraagprijs' | 'ontbreekt';

export const BUYER_FEE_BASIS_LABELS: Record<BuyerFeeBasisSource, string> = {
  beoogde_aankoopprijs: 'beoogde aankoopprijs',
  vraagprijs: 'vraagprijs',
  ontbreekt: 'ontbreekt',
};

export function resolveBuyerFeeBasis(scenario: Pick<Scenario, 'purchase_price' | 'asking_price'>): {
  basis: number;
  source: BuyerFeeBasisSource;
} {
  const purchase = Number(scenario.purchase_price ?? 0);
  if (purchase > 0) return { basis: purchase, source: 'beoogde_aankoopprijs' };
  const asking = Number(scenario.asking_price ?? 0);
  if (asking > 0) return { basis: asking, source: 'vraagprijs' };
  return { basis: 0, source: 'ontbreekt' };
}

export type BuyerFeeStaffelResult = {
  basis: number;
  basisSource: BuyerFeeBasisSource;
  tier: BuyerFeeTier | null;
  pctExVat: number;
  vatPct: number;
  /** Fee ex. btw (afgerond op hele euro's). */
  amountExVat: number;
  /** Btw-bedrag over fee ex. btw. */
  vatAmount: number;
  /** Fee incl. btw — telt mee in totale investering. */
  amountInclVat: number;
};

export function computeBitoBuyerFee(
  scenario: Pick<Scenario, 'purchase_price' | 'asking_price' | 'buyer_fee_vat_percentage'>,
): BuyerFeeStaffelResult {
  const { basis, source } = resolveBuyerFeeBasis(scenario);
  const vatPct = Number(scenario.buyer_fee_vat_percentage ?? DEFAULT_BUYER_FEE_VAT_PCT);
  if (basis <= 0) {
    return { basis: 0, basisSource: source, tier: null, pctExVat: 0, vatPct, amountExVat: 0, vatAmount: 0, amountInclVat: 0 };
  }
  const tier = selectBuyerFeeTier(basis);
  const amountExVat = Math.round((basis * tier.pctExVat) / 100);
  const vatAmount = Math.round((amountExVat * vatPct) / 100);
  return {
    basis,
    basisSource: source,
    tier,
    pctExVat: tier.pctExVat,
    vatPct,
    amountExVat,
    vatAmount,
    amountInclVat: amountExVat + vatAmount,
  };
}
