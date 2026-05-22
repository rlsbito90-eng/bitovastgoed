// Verkoop / exit-berekeningen voor de Vastgoedrekenen-module.
// Pure functions — null-safe, geen DB-calls.

import type { Scenario } from './types';

export const SALE_STRATEGY_LABELS: Record<string, string> = {
  geen_verkoop: 'Geen verkoop',
  leeg_verkopen: 'Leeg verkopen',
  verhuurd_verkopen: 'Verhuurd verkopen',
  uitponden: 'Uitponden',
  splitsen_verkopen: 'Splitsen en verkopen',
  renoveren_verkopen: 'Renoveren en verkopen',
  transformeren_verkopen: 'Transformeren en verkopen',
  per_unit_verkopen: 'Per unit verkopen',
  eindbelegger_exit: 'Eindbelegger exit',
  anders: 'Anders',
};

/** Strategieën waarbij verkoop/exit standaard prominent zichtbaar is. */
export const SALE_FOCUSED_STRATEGIES = new Set<string>([
  'uitponden',
  'splitsen',
  'verkopen_geheel',
  'verkoop_per_unit',
  'bedrijfsunits_los',
  'buy_fix_sell',
  'buy_split_sell',
  'buy_transform_sell',
  'herontwikkeling',
]);

export const SALE_FOCUSED_SALE_STRATEGIES = new Set<string>([
  'leeg_verkopen',
  'verhuurd_verkopen',
  'uitponden',
  'splitsen_verkopen',
  'renoveren_verkopen',
  'transformeren_verkopen',
  'per_unit_verkopen',
  'eindbelegger_exit',
]);

const n = (v: unknown): number => {
  if (v == null) return 0;
  const x = Number(v);
  return isFinite(x) ? x : 0;
};

export type SaleComputation = {
  hasAnySaleInput: boolean;
  grossSaleProceeds: number | null;
  saleCostsTotal: number | null;
  netSaleProceeds: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  roi: number | null; // %
  exitValue: number | null;
  saleVsPurchase: number | null;
  saleVsTotalInvestment: number | null;
  exitBasedMaxBid: number | null;
  exitBidBindingTarget: 'marge_euro' | 'marge_pct' | 'roi' | 'target_exit' | null;
};

/**
 * Bruto verkoopopbrengst, kies op basis van expliciet aangeduide bron (sale_price_source)
 * of valt terug op eerste beschikbare: totaal → per m² → per unit.
 * Voorkomt rekenloops wanneer beide totaal en €/m² zijn ingevuld.
 */
export function computeGrossSaleProceeds(s: Scenario): number | null {
  const rec = s as Record<string, unknown>;
  const source = (rec.sale_price_source as string | null) ?? null;
  const total = n(rec.sale_price_total);
  const ppm2 = n(rec.sale_price_per_m2);
  const m2 = n(rec.sale_sellable_m2);
  const ppu = n(rec.sale_price_per_unit);
  const units = n(rec.sale_units_count);

  if (source === 'per_m2' && ppm2 > 0 && m2 > 0) return Math.round(ppm2 * m2);
  if (source === 'total' && total > 0) return Math.round(total);

  // Fallback / auto-detect (bestaande data zonder source)
  if (total > 0) return Math.round(total);
  if (ppm2 > 0 && m2 > 0) return Math.round(ppm2 * m2);
  if (ppu > 0 && units > 0) return Math.round(ppu * units);
  return null;
}


export function computeSaleCosts(gross: number | null, s: Scenario): number | null {
  if (gross == null) return null;
  const pct = n((s as Record<string, unknown>).sale_costs_percentage);
  const other = n((s as Record<string, unknown>).sale_other_costs);
  const pctPart = (gross * pct) / 100;
  const total = Math.round(pctPart + other);
  return total > 0 ? total : (pct > 0 || other > 0 ? total : null);
}

export function computeSale(s: Scenario, totalInvestment: number, purchasePrice: number): SaleComputation {
  const rec = s as Record<string, unknown>;
  const hasAnySaleInput = [
    'sale_strategy', 'sale_price_total', 'sale_price_per_m2', 'sale_price_per_unit',
    'sale_units_count', 'sale_sellable_m2', 'sale_costs_percentage', 'sale_other_costs',
    'sale_exit_value_manual', 'sale_target_margin_amount', 'sale_target_margin_percentage',
    'sale_target_roi_percentage', 'sale_target_exit_value',
  ].some((k) => {
    const v = rec[k];
    return v != null && v !== '' && !(typeof v === 'number' && v === 0);
  }) || (rec.sale_strategy != null && rec.sale_strategy !== 'geen_verkoop');

  const gross = computeGrossSaleProceeds(s);
  const costs = computeSaleCosts(gross, s);
  const net = gross != null ? gross - (costs ?? 0) : null;
  const manualExit = n(rec.sale_exit_value_manual);
  const exitValue = manualExit > 0 ? manualExit : (net ?? null);
  const marginBasis = net ?? exitValue;
  const grossMargin = gross != null && totalInvestment > 0 ? gross - totalInvestment : null;
  const netMargin = marginBasis != null && totalInvestment > 0 ? marginBasis - totalInvestment : null;
  const roi = netMargin != null && totalInvestment > 0
    ? Number(((netMargin / totalInvestment) * 100).toFixed(2))
    : null;

  const saleVsPurchase = gross != null && purchasePrice > 0 ? gross - purchasePrice : null;
  const saleVsTotalInvestment = net != null && totalInvestment > 0 ? net - totalInvestment : null;

  // Exit-gebaseerde max bieding: net - target winst - kosten exkl. aankoopprijs.
  // We rekenen hier alleen de "max all-in"; aftrek van overhead gebeurt in compute.ts
  // omdat aankoop/OVB/kosten centraal beschikbaar zijn. Hier leveren we alleen de
  // gewenste minimum opbrengst-target.
  let exitBasedMaxBid: number | null = null;
  let binding: SaleComputation['exitBidBindingTarget'] = null;
  if (marginBasis != null && marginBasis > 0) {
    const targetMarginEur = n(rec.sale_target_margin_amount);
    const targetMarginPct = n(rec.sale_target_margin_percentage);
    const targetRoiPct = n(rec.sale_target_roi_percentage);
    const targetExit = n(rec.sale_target_exit_value);

    // Verzamel candidaten voor max totale investering = net - winst
    const candidates: Array<{ key: NonNullable<SaleComputation['exitBidBindingTarget']>; maxTotalInvestment: number }> = [];
    if (targetMarginEur > 0) {
      candidates.push({ key: 'marge_euro', maxTotalInvestment: marginBasis - targetMarginEur });
    }
    if (targetMarginPct > 0) {
      // marge% van netto opbrengst
      candidates.push({ key: 'marge_pct', maxTotalInvestment: marginBasis * (1 - targetMarginPct / 100) });
    }
    if (targetRoiPct > 0) {
      // ROI = marge / TI → TI = net / (1 + ROI%)
      candidates.push({ key: 'roi', maxTotalInvestment: marginBasis / (1 + targetRoiPct / 100) });
    }
    if (targetExit > 0 && targetExit < marginBasis) {
      // exitwaarde-target = max TI
      candidates.push({ key: 'target_exit', maxTotalInvestment: targetExit });
    }

    if (candidates.length > 0) {
      // Bindende = strengste = laagste maxTotalInvestment
      const tightest = candidates.reduce((a, b) => (a.maxTotalInvestment <= b.maxTotalInvestment ? a : b));
      // Max totale investering opgeleverd. Aftrekken van overhead doen we in compute.ts.
      exitBasedMaxBid = Math.max(0, Math.round(tightest.maxTotalInvestment));
      binding = tightest.key;
    }
  }

  return {
    hasAnySaleInput,
    grossSaleProceeds: gross,
    saleCostsTotal: costs,
    netSaleProceeds: net,
    grossMargin,
    netMargin,
    roi,
    exitValue,
    saleVsPurchase,
    saleVsTotalInvestment,
    exitBasedMaxBid,
    exitBidBindingTarget: binding,
  };
}
