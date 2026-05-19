// Scores: inputbetrouwbaarheid, risico, complexiteit, deal score.

import type { Component, Scenario, ScenarioCost, WwsUnit } from './types';
import { VR_DEFAULTS } from './defaults';

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
