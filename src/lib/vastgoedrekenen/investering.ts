// Aankoopkosten, totale investering, prijs per m².

import type { Scenario, ScenarioCost } from './types';

export type AcquisitionBreakdown = {
  buyerFeeBase: number;
  buyerFeeVat: number;
  totalAcquisitionCosts: number; // excl. OVB en excl. aankoopprijs zelf
};

export function computeAcquisitionCosts(scenario: Scenario): AcquisitionBreakdown {
  const purchase = Number(scenario.purchase_price ?? 0);
  const buyerFeeBase = scenario.buyer_fee_amount != null
    ? Number(scenario.buyer_fee_amount)
    : Math.round((purchase * Number(scenario.buyer_fee_percentage ?? 0)) / 100);
  const buyerFeeVat = Math.round((buyerFeeBase * Number(scenario.buyer_fee_vat_percentage ?? 0)) / 100);
  const totalAcquisitionCosts =
    buyerFeeBase + buyerFeeVat +
    Number(scenario.notary_costs ?? 0) +
    Number(scenario.advisory_costs ?? 0) +
    Number(scenario.due_diligence_costs ?? 0) +
    Number(scenario.other_acquisition_costs ?? 0) +
    Number(scenario.safety_margin ?? 0);
  return { buyerFeeBase, buyerFeeVat, totalAcquisitionCosts };
}

/** Bereken effectief bedrag van een kostenpost: per_m2 × m2_basis óf totaalbedrag. */
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

export function computeTotalCosts(costs: ScenarioCost[], unforeseenPct: number): { totalDirect: number; unforeseen: number; total: number } {
  const totalDirect = costs.reduce((s, c) => s + effectiveCostAmount(c), 0);
  const unforeseen = Math.round((totalDirect * Number(unforeseenPct ?? 0)) / 100);
  return { totalDirect, unforeseen, total: totalDirect + unforeseen };
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
