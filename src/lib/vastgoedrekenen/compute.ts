// Orchestrator die alle Vastgoedrekenen-berekeningen samenbrengt
// voor één scenario. Pure function — geen DB-calls.

import type { Component, Scenario, ScenarioCost, WwsUnit, TaxSettings, ComputedOutputs } from './types';
import { computeScenarioOvb } from './ovb';
import {
  annualFromMonthly, getWwsCorrectedAnnualRent, pickCorrectedAnnualRent, computeNoi, bar as fnBar, factor as fnFactor,
} from './huur';
import { computeAcquisitionCosts, computeTotalCosts, computeTotalInvestment, pricePerM2 } from './investering';
import { computeBidAdvice } from './bieding';
import { computeInputReliability, computeRiskScore, computeComplexity, computeDealScore } from './scores';
import { buildConclusion, buildNextStep } from './conclusie';

export type ComputeContext = {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  taxSettings: TaxSettings | null;
  objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
};

export function computeScenario(ctx: ComputeContext): ComputedOutputs {
  const { scenario, components, costs, wwsUnits, taxSettings, objectType, objectArea } = ctx;
  const purchase = Number(scenario.purchase_price ?? 0);
  const asking = Number(scenario.asking_price ?? 0);

  // OVB
  const ovb = computeScenarioOvb(scenario, components, taxSettings);

  // Aankoopkosten
  const acq = computeAcquisitionCosts(scenario);

  // Huur
  const currentAnnual = annualFromMonthly(scenario.current_monthly_rent);
  const marketAnnual = annualFromMonthly(scenario.market_monthly_rent);
  const wwsAnnual = getWwsCorrectedAnnualRent(wwsUnits);
  const correctedAnnual = pickCorrectedAnnualRent(scenario, wwsAnnual);
  const noi = computeNoi(correctedAnnual, {
    vacancyPct: Number(scenario.vacancy_percentage ?? 0),
    operatingCostPct: Number(scenario.operating_cost_percentage ?? 0),
    maintenanceReservePct: Number(scenario.maintenance_reserve_percentage ?? 0),
    managementCostPct: Number(scenario.management_cost_percentage ?? 0),
  }, Number(scenario.other_annual_costs ?? 0));

  // Kosten + investering
  const totals = computeTotalCosts(costs, Number(scenario.unforeseen_percentage ?? 0));
  const financing = Number(scenario.financing_costs ?? 0);
  const totalInvestment = computeTotalInvestment({
    purchasePrice: purchase,
    totalTransferTax: ovb.totalOvb,
    totalAcquisitionCosts: acq.totalAcquisitionCosts,
    totalCosts: totals.total,
    financingCosts: financing,
  });

  const barPurchase = fnBar(correctedAnnual, purchase);
  const barTotal = fnBar(correctedAnnual, totalInvestment);
  const factorPurchase = fnFactor(purchase, correctedAnnual);
  const factorTotal = fnFactor(totalInvestment, correctedAnnual);

  // Biedingsadvies
  const bid = computeBidAdvice({
    correctedAnnualRent: correctedAnnual,
    targetBar: Number(scenario.target_bar ?? 6),
    totalAcquisitionCosts: acq.totalAcquisitionCosts,
    totalCosts: totals.total,
    financingCosts: financing,
    safetyMargin: Number(scenario.safety_margin ?? 0),
  });

  const differenceWithAsking = asking - bid.realistic;
  const requiredDiscount = Math.max(0, asking - bid.maxBid);

  // Scores
  const scoreInput = {
    scenario, components, costs, wwsUnits, objectType,
    barTotalInvestment: barTotal,
    hasObjectArea: !!objectArea && objectArea > 0,
    hasWoz: !!ctx.objectWoz,
    hasEnergyLabel: !!ctx.objectEnergyLabel,
    hasBouwjaar: !!ctx.objectBouwjaar,
    bouwjaar: ctx.objectBouwjaar ?? null,
  };
  const inputReliability = computeInputReliability(scoreInput);
  const risk = computeRiskScore(scoreInput);
  const complexity = computeComplexity(scoreInput);
  const dealScore = computeDealScore(scoreInput, risk.level);

  // Conclusie
  const conclusion = buildConclusion({
    dealScore,
    barTotalInvestment: barTotal,
    maximumBid: bid.maxBid,
    differenceWithAskingPrice: differenceWithAsking,
    requiredDiscount,
    inputReliability,
    riskScore: risk.level,
    complexityScore: complexity,
    askingPrice: asking,
  });
  const nextStep = buildNextStep({
    inputReliability,
    missingWoz: !ctx.objectWoz,
    missingLabel: !ctx.objectEnergyLabel,
    missingContracts: !components.some((c) => c.has_contract),
    hasWwsRisk: wwsUnits.some((u) => (u.wws_points ?? 0) > 0 && (u.wws_points ?? 0) < 187),
    isMixedUseWithoutAlloc: objectType === 'mixed_use' && scenario.ovb_mode !== 'per_component',
    dealScore,
  });

  return {
    totalTransferTax: ovb.totalOvb,
    totalAcquisitionCosts: acq.totalAcquisitionCosts,
    totalCosts: totals.total,
    totalInvestment,
    currentAnnualRent: currentAnnual,
    marketAnnualRent: marketAnnual,
    wwsCorrectedAnnualRent: wwsAnnual,
    correctedAnnualRent: correctedAnnual,
    noi,
    pricePerM2Gbo: pricePerM2(purchase, objectArea),
    barPurchasePrice: barPurchase,
    barTotalInvestment: barTotal,
    factorPurchasePrice: factorPurchase,
    factorTotalInvestment: factorTotal,
    maximumAllInValue: bid.maxAllInValue,
    maximumBid: bid.maxBid,
    conservativeBid: bid.conservative,
    realisticBid: bid.realistic,
    aggressiveBid: bid.aggressive,
    notInterestingAbove: bid.notInterestingAbove,
    differenceWithAskingPrice: differenceWithAsking,
    requiredDiscount,
    dealScore,
    riskScore: risk.level,
    complexityScore: complexity,
    inputReliability,
    conclusion,
    recommendedNextStep: nextStep,
    warnings: risk.flags,
  };
}
