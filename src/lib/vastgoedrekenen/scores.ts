// Scores: inputbetrouwbaarheid, risico, complexiteit, deal score.

import type { Component, Scenario, ScenarioAssessmentType, ScenarioCost, ScenarioScoreLabel, WwsUnit } from './types';
import { VR_DEFAULTS } from './defaults';
import { SALE_FOCUSED_SALE_STRATEGIES, SALE_FOCUSED_STRATEGIES } from './verkoop';

export type ScoreInput = {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  objectType: 'enkelvoudig' | 'mixed_use';
  barTotalInvestment: number | null;
  hasObjectArea: boolean;
  hasWoz: boolean;
  hasEnergyLabel: boolean;
  hasBouwjaar: boolean;
  bouwjaar?: number | null;
};

export function computeInputReliability(i: ScoreInput): 'laag' | 'middel' | 'hoog' {
  let score = 0;
  if (i.scenario.purchase_price) score++;
  if (i.hasObjectArea) score++;
  if ((i.scenario.current_monthly_rent ?? 0) > 0 || (i.scenario.market_monthly_rent ?? 0) > 0) score++;
  if (i.hasWoz) score++;
  if (i.hasEnergyLabel) score++;
  if (i.hasBouwjaar) score++;
  if (i.costs.length > 0) score++;
  if (i.objectType === 'enkelvoudig' || i.components.length > 0) score++;
  if (score >= 7) return 'hoog';
  if (score >= 4) return 'middel';
  return 'laag';
}

export function computeRiskScore(i: ScoreInput): { level: 'laag' | 'middel' | 'hoog'; flags: string[] } {
  const flags: string[] = [];
  // WWS-risico
  const heeftSociaalOfMid = i.wwsUnits.some((u) => (u.wws_points ?? 0) > 0 && (u.wws_points ?? 0) < 187);
  if (heeftSociaalOfMid) flags.push('WWS-risico: één of meerdere woonunits onder 187 WWS-punten.');
  // Markthuur boven WWS-huur
  if (i.wwsUnits.some((u) =>
    (u.wws_max_monthly_rent ?? 0) > 0 &&
    Number(i.scenario.market_monthly_rent ?? 0) > (u.wws_max_monthly_rent ?? 0),
  )) flags.push('Markthuur ligt boven WWS-maximale huur.');
  // Kostenrisico
  if (i.costs.length === 0) flags.push('Geen kosten/bouwkosten ingevuld.');
  // Transformatie / splitsen
  if (i.scenario.strategy_type === 'transformeren') flags.push('Vergunningrisico door transformatiescenario.');
  if (i.scenario.strategy_type === 'splitsen' || i.scenario.strategy_type === 'uitponden') flags.push('Juridisch/splitsingsrisico.');
  // Bouwkundig
  if (i.bouwjaar && i.bouwjaar < 1970) flags.push('Bouwjaar vóór 1970 — bouwkundig risico.');
  // Mixed-use OVB
  if (i.objectType === 'mixed_use' && i.scenario.ovb_mode !== 'per_component') {
    flags.push('Mixed-use object zonder OVB-toerekening per component.');
  }
  // BAR ondergrens
  if (i.barTotalInvestment != null && i.barTotalInvestment < 5) flags.push('BAR op totale investering laag (<5%).');

  const high = flags.filter((f) => /risico|<5%|zonder OVB-toerekening/i.test(f)).length;
  const level = high >= 2 ? 'hoog' : flags.length >= 2 ? 'middel' : 'laag';
  return { level, flags };
}

export function computeComplexity(i: ScoreInput): 'laag' | 'middel' | 'hoog' | 'zeer_hoog' {
  const s = i.scenario.strategy_type;
  let level: 'laag' | 'middel' | 'hoog' | 'zeer_hoog' = 'laag';
  if (s === 'huur_optimaliseren' || s === 'renoveren_verhuren' || i.components.length > 1) level = 'middel';
  if (s === 'transformeren' || s === 'splitsen' || s === 'uitponden' || i.objectType === 'mixed_use') level = 'hoog';
  if ((i.bouwjaar && i.bouwjaar < 1940) || i.wwsUnits.some((u) => u.monument_status)) level = 'zeer_hoog';
  return level;
}

export function computeDealScore(i: ScoreInput, risk: 'laag' | 'middel' | 'hoog'): 'A' | 'B' | 'C' | 'reject' {
  const bar = i.barTotalInvestment ?? 0;
  if (bar >= VR_DEFAULTS.dealScoreBarA && risk !== 'hoog') return 'A';
  if (bar >= VR_DEFAULTS.dealScoreBarB) return 'B';
  if (bar >= VR_DEFAULTS.dealScoreBarC) return 'C';
  return 'reject';
}

export function determineAssessmentType(scenario: Scenario): ScenarioAssessmentType {
  const rec = scenario as Record<string, unknown>;
  const saleStrategy = typeof rec.sale_strategy === 'string' ? rec.sale_strategy : null;
  const bidBasis = typeof rec.bid_basis === 'string' ? rec.bid_basis : null;
  if (bidBasis === 'verkoop') return 'verkoop';
  if (saleStrategy && saleStrategy !== 'geen_verkoop' && SALE_FOCUSED_SALE_STRATEGIES.has(saleStrategy)) return 'verkoop';
  if (SALE_FOCUSED_STRATEGIES.has(String(scenario.strategy_type))) return 'verkoop';
  return 'exploitatie';
}

export type SaleScoreInput = {
  netSaleProceeds: number | null;
  exitValue: number | null;
  totalInvestment: number;
  netMargin: number | null;
  roi: number | null;
  maximumBid: number;
  askingPrice: number;
  purchasePrice: number;
  targetRoi: number;
  targetMarginAmount: number;
  targetMarginPercentage: number;
  targetExitValue: number;
  saleHasInput: boolean;
  exitIsManual: boolean;
  hasIndicativeCosts: boolean;
};

export type ScenarioScoreResult = {
  label: ScenarioScoreLabel;
  dealScore: 'A' | 'B' | 'C' | 'reject';
  reason: string;
  positivePoints: string[];
  attentionPoints: string[];
};

const eur = (value: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export function computeSaleScenarioScore(i: SaleScoreInput): ScenarioScoreResult {
  const positives: string[] = [];
  const attention: string[] = [];
  const targetPrice = i.askingPrice > 0 ? i.askingPrice : i.purchasePrice;

  if (i.netMargin != null) positives.push(`Nettomarge: ${eur(i.netMargin)}`);
  if (i.roi != null) positives.push(`ROI: ${i.roi.toFixed(1)}%`);
  if (i.targetRoi > 0) positives.push(`Gewenste ROI: ${i.targetRoi.toFixed(1)}%`);
  if (i.maximumBid > 0) positives.push(`Maximale bieding o.b.v. exit: ${eur(i.maximumBid)}`);
  if (i.hasIndicativeCosts) attention.push('Bouwkosten zijn indicatief.');
  if (i.exitIsManual) attention.push('Exitwaarde is handmatig ingevoerd.');
  if (targetPrice > 0) {
    attention.push(i.maximumBid >= targetPrice ? 'Maximale bieding ligt rond of boven de vraag-/aankoopprijs.' : 'Maximale bieding ligt onder de vraag-/aankoopprijs.');
  }

  const insufficient = !i.saleHasInput || (i.netSaleProceeds == null && i.exitValue == null);
  if (insufficient) {
    return { label: 'Onvoldoende data', dealScore: 'reject', reason: 'Verkoopopbrengst ontbreekt.', positivePoints: positives, attentionPoints: ['Verkoopopbrengst ontbreekt.', ...attention] };
  }
  if (i.targetRoi > 0 && (i.roi == null || i.roi < i.targetRoi)) {
    return { label: 'ROI onvoldoende', dealScore: 'C', reason: 'ROI ligt onder gewenste ROI.', positivePoints: positives, attentionPoints: ['ROI ligt onder gewenste ROI.', ...attention] };
  }
  if (i.targetMarginAmount > 0 && (i.netMargin == null || i.netMargin < i.targetMarginAmount)) {
    return { label: 'Marge onvoldoende', dealScore: 'C', reason: 'Nettomarge ligt onder de gewenste winstmarge.', positivePoints: positives, attentionPoints: ['Nettomarge ligt onder de gewenste winstmarge.', ...attention] };
  }
  if (i.targetMarginPercentage > 0 && (i.netSaleProceeds == null || i.netMargin == null || (i.netMargin / i.netSaleProceeds) * 100 < i.targetMarginPercentage)) {
    return { label: 'Marge onvoldoende', dealScore: 'C', reason: 'Nettomargepercentage ligt onder de gewenste marge.', positivePoints: positives, attentionPoints: ['Nettomargepercentage ligt onder de gewenste marge.', ...attention] };
  }
  if (i.targetExitValue > 0 && (i.exitValue == null || i.exitValue < i.targetExitValue)) {
    return { label: 'Exitdoel niet gehaald', dealScore: 'C', reason: 'Netto verkoopopbrengst ligt onder target exitwaarde.', positivePoints: positives, attentionPoints: ['Netto verkoopopbrengst ligt onder target exitwaarde.', ...attention] };
  }
  if (targetPrice > 0 && i.maximumBid > 0 && i.maximumBid < targetPrice) {
    return { label: 'Te duur', dealScore: 'C', reason: 'Maximale bieding ligt onder vraag-/aankoopprijs.', positivePoints: positives, attentionPoints: ['Maximale bieding ligt onder vraag-/aankoopprijs.', ...attention] };
  }
  if (i.netMargin == null || i.netMargin <= 0 || i.roi == null || i.roi < 0) {
    return { label: 'Niet haalbaar', dealScore: 'reject', reason: 'Nettomarge of ROI is negatief.', positivePoints: positives, attentionPoints: ['Nettomarge of ROI is negatief.', ...attention] };
  }

  const roiBeatsTarget = i.targetRoi <= 0 || i.roi >= i.targetRoi;
  const bidMeetsPrice = targetPrice <= 0 || i.maximumBid >= targetPrice * 0.98;
  if (roiBeatsTarget && bidMeetsPrice) {
    return { label: 'Kansrijk', dealScore: 'A', reason: 'Nettomarge is positief, ROI haalt de target en de maximale bieding ligt rond of boven de prijs.', positivePoints: positives, attentionPoints: attention };
  }
  if (roiBeatsTarget) {
    return { label: 'Acceptabel', dealScore: 'B', reason: 'Nettomarge is positief en ROI ligt rond of boven de gewenste ROI.', positivePoints: positives, attentionPoints: attention };
  }
  return { label: 'Onzeker', dealScore: 'C', reason: 'Positieve marge, maar targets of prijsruimte vragen extra controle.', positivePoints: positives, attentionPoints: attention };
}
