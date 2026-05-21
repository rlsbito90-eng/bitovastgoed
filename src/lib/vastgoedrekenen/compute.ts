// Orchestrator die alle Vastgoedrekenen-berekeningen samenbrengt
// voor één scenario. Pure function — geen DB-calls.

import type { Component, Scenario, ScenarioCost, WwsUnit, TaxSettings, ComputedOutputs } from './types';
import { computeScenarioOvb } from './ovb';
import {
  annualFromMonthly, getWwsCorrectedAnnualRent, pickCorrectedAnnualRent, bar as fnBar, factor as fnFactor,
} from './huur';
import { computeAcquisitionCosts, computeTotalCosts, computeTotalInvestment, pricePerM2 } from './investering';
import { computeBidAdvice } from './bieding';
import { computeInputReliability, computeRiskScore, computeComplexity, computeDealScore } from './scores';
import { buildConclusion, buildNextStep } from './conclusie';
import { getAssumptionSet, type PropertyAssumptionType } from './profiles';

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
  /** Vastgoedtype voor het aannameprofiel. Default: mapping op basis van objectType. */
  propertyType?: PropertyAssumptionType;
};

function sumComponentMonthly(components: Component[], key: 'current_monthly_rent' | 'market_monthly_rent'): number {
  return components.reduce((s, c) => s + Number(c[key] ?? 0), 0);
}

export function computeScenario(ctx: ComputeContext): ComputedOutputs {
  const { scenario, components, costs, wwsUnits, taxSettings, objectType, objectArea } = ctx;
  const purchase = Number(scenario.purchase_price ?? 0);
  const asking = Number(scenario.asking_price ?? 0);
  const propertyType: PropertyAssumptionType = ctx.propertyType ?? (objectType === 'mixed_use' ? 'mixed_use' : 'residentieel');

  // --- Aannameprofiel toepassen (tenzij handmatig) ---
  const profile = scenario.assumption_profile as 'licht' | 'normaal' | 'conservatief' | 'zwaar' | 'handmatig' | null;
  const profileSet = profile ? getAssumptionSet(propertyType, profile) : null;
  const vacancyPct = profileSet ? profileSet.vacancy_percentage : Number(scenario.vacancy_percentage ?? 0);
  const opCostPct = profileSet ? profileSet.operating_cost_percentage : Number(scenario.operating_cost_percentage ?? 0);
  const maintPct = profileSet ? profileSet.maintenance_reserve_percentage : Number(scenario.maintenance_reserve_percentage ?? 0);
  const mgmtPct = profileSet ? profileSet.management_cost_percentage : Number(scenario.management_cost_percentage ?? 0);
  const otherPct = profileSet ? profileSet.other_percentage : 0;

  // --- OVB ---
  const ovb = computeScenarioOvb(scenario, components, taxSettings);

  // --- Aankoopkosten ---
  const acq = computeAcquisitionCosts(scenario);

  // --- Huurbron ---
  const rentSource = (scenario.rent_source as 'handmatig' | 'componenten' | 'wws_gecorrigeerd' | 'handmatig_gecorrigeerd' | null) ?? 'handmatig';
  let currentMonthly = scenario.current_monthly_rent ?? 0;
  let marketMonthly = scenario.market_monthly_rent ?? 0;
  if (rentSource === 'componenten' && components.length > 0) {
    currentMonthly = sumComponentMonthly(components, 'current_monthly_rent');
    marketMonthly = sumComponentMonthly(components, 'market_monthly_rent');
  }
  const currentAnnual = annualFromMonthly(currentMonthly);
  const marketAnnual = annualFromMonthly(marketMonthly);
  const wwsAnnual = getWwsCorrectedAnnualRent(wwsUnits);

  // Mapping huurbron → rent_choice voor pickCorrectedAnnualRent
  let effectiveRentChoice = scenario.rent_choice;
  if (rentSource === 'wws_gecorrigeerd') effectiveRentChoice = 'wws';
  if (rentSource === 'handmatig_gecorrigeerd') effectiveRentChoice = 'handmatig';

  const correctedAnnual = pickCorrectedAnnualRent({
    rent_choice: effectiveRentChoice,
    current_monthly_rent: currentMonthly,
    market_monthly_rent: marketMonthly,
    manual_corrected_monthly_rent: scenario.manual_corrected_monthly_rent,
  } as Scenario, wwsAnnual);

  // --- NOI-opbouw ---
  const vacancyCorrectionEur = Math.round((correctedAnnual * vacancyPct) / 100);
  const operatingCostsEur = Math.round((correctedAnnual * opCostPct) / 100);
  const maintenanceCostsEur = Math.round((correctedAnnual * maintPct) / 100);
  const managementCostsEur = Math.round((correctedAnnual * mgmtPct) / 100);
  const otherCostsEur = Math.round((correctedAnnual * otherPct) / 100) + Math.round(Number(scenario.other_annual_costs ?? 0));
  const totalCorrectionPct = vacancyPct + opCostPct + maintPct + mgmtPct + otherPct;
  const noi = Math.max(0, correctedAnnual - vacancyCorrectionEur - operatingCostsEur - maintenanceCostsEur - managementCostsEur - otherCostsEur);
  const noiMargin = correctedAnnual > 0 ? Number(((noi / correctedAnnual) * 100).toFixed(2)) : null;

  // --- Kosten + investering ---
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
  const narTotal = totalInvestment > 0 ? Number(((noi / totalInvestment) * 100).toFixed(2)) : null;

  // --- Biedingsadvies ---
  const bid = computeBidAdvice({
    correctedAnnualRent: correctedAnnual,
    targetBar: Number(scenario.target_bar ?? 6),
    totalAcquisitionCosts: acq.totalAcquisitionCosts,
    totalCosts: totals.total,
    financingCosts: financing,
    safetyMargin: Number(scenario.safety_margin ?? 0),
  });

  // Verschil met vraagprijs op basis van MAXIMALE BIEDING (niet realisticBid).
  // Positief = biedingsruimte boven vraagprijs; negatief = benodigde prijsverlaging.
  const differenceWithAsking = asking > 0 ? bid.maxBid - asking : 0;
  const requiredDiscount = asking > 0 && bid.maxBid < asking ? asking - bid.maxBid : 0;

  // --- Scores ---
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

  // --- Conclusie ---
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
    noiMargin,
    totalCorrectionPct,
    vacancyCorrectionEur,
    operatingCostsEur,
    maintenanceCostsEur,
    managementCostsEur,
    otherCostsEur,
    pricePerM2Gbo: pricePerM2(purchase, objectArea),
    barPurchasePrice: barPurchase,
    barTotalInvestment: barTotal,
    factorPurchasePrice: factorPurchase,
    factorTotalInvestment: factorTotal,
    narTotalInvestment: narTotal,
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
