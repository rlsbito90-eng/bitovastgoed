// Orchestrator die alle Vastgoedrekenen-berekeningen samenbrengt
// voor één scenario. Pure function — geen DB-calls.

import type { Component, Scenario, ScenarioCost, WwsUnit, TaxSettings, ComputedOutputs, SellOffUnit } from './types';
import { computeScenarioOvb } from './ovb';
import {
  annualFromMonthly, getWwsCorrectedAnnualRent, pickCorrectedAnnualRent, bar as fnBar, factor as fnFactor,
} from './huur';
import { computeAcquisitionCosts, computeTotalCosts, computeTotalInvestment, pricePerM2 } from './investering';
import { computeBidAdvice } from './bieding';
import { computeInputReliability, computeRiskScore, computeComplexity, computeDealScore, computeSaleScenarioScore, determineAssessmentType } from './scores';
import { buildConclusion, buildNextStep } from './conclusie';
import { getAssumptionSet, type PropertyAssumptionType } from './profiles';
import { computeSale } from './verkoop';
import { aggregateStrategy } from './componentStrategy';

export type ComputeContext = {
  scenario: Scenario;
  components: Component[];
  costs: ScenarioCost[];
  wwsUnits: WwsUnit[];
  /** Optionele componentstrategie-units (uit sell_off_units). */
  strategyUnits?: SellOffUnit[];
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

const eur = (n: number | null | undefined) => n == null
  ? '—'
  : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

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

  // --- Componentstrategie vooraf zodat OVB met allocation_method='strategy' kan rekenen ---
  const strategy = aggregateStrategy(ctx.strategyUnits ?? []);
  const strategyValueByComponentId = new Map<string, number>();
  for (const u of (ctx.strategyUnits ?? [])) {
    const compId = (u as unknown as { component_id?: string | null }).component_id;
    if (!compId) continue;
    const res = strategy.perUnit.find((p) => p.unitId === u.id);
    if (!res) continue;
    // Grondslag = bijdrage uit strategie (netto verkoop of holdwaarde).
    const v = Math.max(0, Math.round(res.contribution));
    strategyValueByComponentId.set(compId, (strategyValueByComponentId.get(compId) ?? 0) + v);
  }

  // --- OVB ---
  const ovbObjectType: 'residentieel' | 'commercieel' | 'mixed_use' =
    propertyType === 'residentieel' ? 'residentieel' : propertyType === 'mixed_use' ? 'mixed_use' : 'commercieel';
  const ovb = computeScenarioOvb(scenario, components, taxSettings, ovbObjectType, strategyValueByComponentId);

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
    totalOvb: ovb.totalOvb,
    totalAcquisitionCosts: acq.totalAcquisitionCosts,
    totalCosts: totals.total,
    financingCosts: financing,
    safetyMargin: Number(scenario.safety_margin ?? 0),
  });

  // --- Verkoop / exit ---
  const sale = computeSale(scenario, totalInvestment, purchase);

  // Exit-gebaseerde max bieding: trek overhead af van de max toegestane totale investering.
  // Symmetrisch met huur-tak: OVB + aankoopkosten (incl. safety_margin) + kosten + financiering.
  // safetyMargin zit al in totalAcquisitionCosts via computeAcquisitionCosts — niet dubbel optellen.
  const overhead = ovb.totalOvb + acq.totalAcquisitionCosts + totals.total + financing;
  const exitBasedMaxBidNet = sale.exitBasedMaxBid != null
    ? Math.max(0, sale.exitBasedMaxBid - overhead)
    : null;

  // Bid-basis: verkoopgerichte cases gebruiken exit-bieding zodra die beschikbaar is.
  const assessmentType = determineAssessmentType(scenario);
  const useSaleBasis = assessmentType === 'verkoop' && exitBasedMaxBidNet != null && exitBasedMaxBidNet > 0;
  const effectiveMaxBid = useSaleBasis ? (exitBasedMaxBidNet as number) : bid.maxBid;
  const bidBasisUsed: 'huur' | 'verkoop' = useSaleBasis ? 'verkoop' : 'huur';

  // Verschil met vraagprijs op basis van de gekozen MAXIMALE BIEDING.
  const differenceWithAsking = asking > 0 ? effectiveMaxBid - asking : 0;
  const requiredDiscount = asking > 0 && effectiveMaxBid < asking ? asking - effectiveMaxBid : 0;

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
  const baseDealScore = computeDealScore(scoreInput, risk.level);
  const rec = scenario as Record<string, unknown>;
  const saleScore = assessmentType === 'verkoop'
    ? computeSaleScenarioScore({
      netSaleProceeds: sale.netSaleProceeds,
      exitValue: sale.exitValue,
      totalInvestment,
      netMargin: sale.netMargin,
      roi: sale.roi,
      maximumBid: effectiveMaxBid,
      askingPrice: asking,
      purchasePrice: purchase,
      targetRoi: Number(rec.sale_target_roi_percentage ?? 0),
      targetMarginAmount: Number(rec.sale_target_margin_amount ?? 0),
      targetMarginPercentage: Number(rec.sale_target_margin_percentage ?? 0),
      targetExitValue: Number(rec.sale_target_exit_value ?? 0),
      saleHasInput: sale.hasAnySaleInput,
      exitIsManual: Number(rec.sale_exit_value_manual ?? 0) > 0,
      hasIndicativeCosts: costs.some((c) => c.reliability_status !== 'hoog'),
    })
    : null;
  let dealScore = saleScore?.dealScore ?? baseDealScore;
  let scoreLabel = saleScore?.label ?? (dealScore === 'A' ? 'Kansrijk' : dealScore === 'B' ? 'Acceptabel' : dealScore === 'C' ? 'Onzeker' : 'Niet haalbaar');
  let scoreReason = saleScore?.reason ?? (dealScore === 'reject'
    ? 'De huur-/rendementsbasis is onvoldoende voor een exploitatiecase.'
    : 'Score gebaseerd op huur, NOI, BAR en rendement op totale investering.');
  const scorePositivePoints = saleScore?.positivePoints ?? [
    `Gecorrigeerde jaarhuur: ${eur(correctedAnnual)}`,
    `NOI: ${eur(noi)}`,
    `BAR op totale investering: ${barTotal != null ? `${barTotal.toFixed(2)}%` : 'n.v.t.'}`,
  ];
  let scoreAttentionPoints = saleScore?.attentionPoints ?? [
    ...(dealScore === 'reject' ? ['BAR/huurinkomsten zijn onvoldoende voor de gewenste rendementseis.'] : []),
    ...risk.flags,
  ];

  // Conclusie + next step worden hieronder berekend, ná de leading-aware override.


  // --- €/m² afgeleide KPI's ---
  const safeDiv = (num: number | null | undefined, den: number | null | undefined): number | null => {
    if (num == null || den == null) return null;
    const n2 = Number(num); const d2 = Number(den);
    if (!isFinite(n2) || !isFinite(d2) || d2 <= 0) return null;
    return Math.round(n2 / d2);
  };
  const gbo = objectArea && objectArea > 0 ? objectArea : null;
  const sellableM2 = Number((scenario as Record<string, unknown>).sale_sellable_m2 ?? 0) || null;
  const salePricePerM2 = sale.grossSaleProceeds != null && sellableM2
    ? safeDiv(sale.grossSaleProceeds, sellableM2)
    : null;
  const netSaleProceedsPerM2 = sale.netSaleProceeds != null && sellableM2
    ? safeDiv(sale.netSaleProceeds, sellableM2)
    : null;
  const netMarginPerM2 = sale.netMargin != null && sellableM2
    ? safeDiv(sale.netMargin, sellableM2)
    : null;

  // --- Componentstrategie totals (strategy is hierboven al berekend t.b.v. OVB-grondslag) ---
  // Bij actieve strategie: investering inclusief extra reno/transformatiekosten van hold-componenten.
  const totalInvestmentWithStrategy = strategy.enabled
    ? totalInvestment + strategy.extraInvestmentCosts
    : totalInvestment;
  const scenarioResultAtAsking = strategy.enabled && asking > 0
    ? strategy.scenarioValue - (asking + ovb.totalOvb + acq.totalAcquisitionCosts + totals.total + financing + strategy.extraInvestmentCosts)
    : null;
  const scenarioMarginPct = strategy.enabled && scenarioResultAtAsking != null && totalInvestmentWithStrategy > 0
    ? Number(((scenarioResultAtAsking / totalInvestmentWithStrategy) * 100).toFixed(2))
    : null;
  // Indicatieve max aankoopprijs: scenariowaarde minus alle niet-aankoopprijs gerelateerde
  // kosten en gewenste marge (target_margin in € op total investment). OVB wordt iteratief
  // bepaald via huidige OVB-helper: pass 1 met huidige OVB-tarief, pass 2 met aangepaste prijs.
  function ovbPctEstimate(): number {
    if (totalInvestment <= 0 || ovb.totalOvb === 0) {
      // fallback: gebruik bestaand tarief uit scenario of OVB-default
      return Number(scenario.transfer_tax_percentage ?? 10.4);
    }
    return purchase > 0 ? (ovb.totalOvb / purchase) * 100 : 10.4;
  }
  const targetMarginEur = Number(scenario.target_margin ?? 0);
  let maxPurchasePrice: number | null = null;
  if (strategy.enabled) {
    const overheadExclOvb = acq.totalAcquisitionCosts + totals.total + financing + Number(scenario.safety_margin ?? 0) + strategy.extraInvestmentCosts + targetMarginEur;
    const ovbPct = ovbPctEstimate();
    // scenarioValue = price * (1 + ovbPct/100) + overheadExclOvb  →  price = (scenarioValue - overheadExclOvb) / (1 + ovbPct/100)
    const denom = 1 + ovbPct / 100;
    if (denom > 0) {
      maxPurchasePrice = Math.max(0, Math.round((strategy.scenarioValue - overheadExclOvb) / denom));
    }
  }
  const roundsAtAsking = strategy.enabled && asking > 0 && maxPurchasePrice != null
    ? maxPurchasePrice >= asking
    : null;

  // Leidende maximale prijs: standaard heuristiek (auto) plus expliciete override
  // via scenario.leading_valuation_track. Per spoor kiezen we de juiste onderliggende
  // waarde, zodat een handmatige keuze altijd zichtbaar doorwerkt — ook als die afwijkt
  // van de automatisch gekozen bid-basis.
  const trackChoice = ((scenario as unknown as Record<string, unknown>).leading_valuation_track as
    | 'auto' | 'huur_bar' | 'scenario_exit' | 'componentstrategie' | null | undefined) ?? 'auto';
  const huurMaxBid = bid.maxBid;
  const verkoopMaxBid = exitBasedMaxBidNet != null ? exitBasedMaxBidNet : effectiveMaxBid;
  let leadingMaxBasis: 'strategie' | 'huur' | 'verkoop';
  let leadingMaxBasisOverridden = false;
  if (trackChoice === 'componentstrategie' && strategy.enabled && maxPurchasePrice != null) {
    leadingMaxBasis = 'strategie';
    leadingMaxBasisOverridden = true;
  } else if (trackChoice === 'scenario_exit') {
    leadingMaxBasis = 'verkoop';
    leadingMaxBasisOverridden = true;
  } else if (trackChoice === 'huur_bar') {
    leadingMaxBasis = 'huur';
    leadingMaxBasisOverridden = true;
  } else {
    // auto
    leadingMaxBasis = strategy.enabled && maxPurchasePrice != null ? 'strategie' : bidBasisUsed;
  }
  const leadingMaxBasisLabel =
    leadingMaxBasis === 'strategie'
      ? `Componentstrategie (max aankoopprijs)${leadingMaxBasisOverridden ? ' · handmatig gekozen' : ''}`
      : leadingMaxBasis === 'verkoop'
        ? `Verkoop / exit-tak (max bieding)${leadingMaxBasisOverridden ? ' · handmatig gekozen' : ''}`
        : `Huur / BAR-tak (max bieding)${leadingMaxBasisOverridden ? ' · handmatig gekozen' : ''}`;
  const leadingMaxValue =
    leadingMaxBasis === 'strategie'
      ? (maxPurchasePrice ?? effectiveMaxBid)
      : leadingMaxBasis === 'verkoop'
        ? verkoopMaxBid
        : huurMaxBid;
  const leadingDifferenceWithAskingPrice = asking > 0 ? leadingMaxValue - asking : 0;
  const leadingRoundsAtAsking = asking > 0 ? leadingMaxValue >= asking : null;

  // --- Leading-aware score-override ---
  // De score moet hetzelfde leidende spoor weerspiegelen als de cockpit/ResultaatKaart.
  // Een informatief alternatief mag niet leiden tot een "Kansrijk" terwijl het leidende
  // spoor geen waarde heeft of niet rond rekent.
  if (asking > 0) {
    if (leadingMaxValue <= 0) {
      dealScore = 'reject';
      scoreLabel = 'Onvoldoende data';
      scoreReason = `Het leidende spoor (${leadingMaxBasisLabel}) heeft geen bruikbare maximum waarde. Vul de bijbehorende invoer aan of kies een ander spoor.`;
      scoreAttentionPoints = [scoreReason, ...scoreAttentionPoints];
    } else if (leadingRoundsAtAsking === false && (dealScore === 'A' || dealScore === 'B')) {
      dealScore = 'C';
      scoreLabel = 'Te duur';
      scoreReason = `Het leidende spoor (${leadingMaxBasisLabel}) rekent niet rond op de vraagprijs. Alternatieve sporen kunnen positief zijn, maar bepalen niet de uitkomst.`;
      scoreAttentionPoints = [scoreReason, ...scoreAttentionPoints];
    }
  }

  // --- Conclusie + next step (op basis van de uiteindelijke leading-aware score) ---
  const conclusion = buildConclusion({
    dealScore,
    barTotalInvestment: barTotal,
    maximumBid: leadingMaxValue,
    differenceWithAskingPrice: leadingDifferenceWithAskingPrice,
    requiredDiscount: asking > 0 && leadingMaxValue < asking ? asking - leadingMaxValue : 0,
    inputReliability,
    riskScore: risk.level,
    complexityScore: complexity,
    askingPrice: asking,
    assessmentType,
    scoreLabel,
    netSaleProceeds: sale.netSaleProceeds,
    netMargin: sale.netMargin,
    roi: sale.roi,
    exitValue: sale.exitValue,
  });
  const nextStep = assessmentType === 'verkoop'
    ? (scoreLabel === 'Onvoldoende data' ? 'Vul verkoopopbrengst of exitwaarde aan vóór beoordeling.' : scoreLabel === 'Kansrijk' || scoreLabel === 'Acceptabel' ? 'Onderbouw exitwaarde en bereid biedingsbandbreedte voor.' : 'Controleer verkoopopbrengst, kosten, marge en ROI-targets.')
    : buildNextStep({
      inputReliability,
      missingWoz: !ctx.objectWoz,
      missingLabel: !ctx.objectEnergyLabel,
      missingContracts: !components.some((c) => c.has_contract),
      hasWwsRisk: wwsUnits.some((u) => (u.wws_points ?? 0) > 0 && (u.wws_points ?? 0) < 187),
      isMixedUseWithoutAlloc: objectType === 'mixed_use' && scenario.ovb_mode !== 'per_component',
      dealScore,
    });

  const combinedWarnings = strategy.enabled ? [...risk.flags, ...strategy.warnings] : risk.flags;


  return {
    totalTransferTax: ovb.totalOvb,
    totalAcquisitionCosts: acq.totalAcquisitionCosts,
    totalCosts: totals.total,
    totalInvestment: totalInvestmentWithStrategy,
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
    maximumBid: effectiveMaxBid,
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
    assessmentType,
    scoreLabel,
    scoreReason,
    scorePositivePoints,
    scoreAttentionPoints,
    conclusion,
    recommendedNextStep: nextStep,
    warnings: combinedWarnings,
    saleHasInput: sale.hasAnySaleInput,
    grossSaleProceeds: sale.grossSaleProceeds,
    saleCostsTotal: sale.saleCostsTotal,
    netSaleProceeds: sale.netSaleProceeds,
    grossMargin: sale.grossMargin,
    netMargin: sale.netMargin,
    roi: sale.roi,
    exitValue: sale.exitValue,
    saleVsPurchase: sale.saleVsPurchase,
    saleVsTotalInvestment: sale.saleVsTotalInvestment,
    exitBasedMaxBid: exitBasedMaxBidNet,
    exitBidBindingTarget: sale.exitBidBindingTarget,
    bidBasisUsed,
    purchasePricePerM2: safeDiv(purchase, gbo),
    askingPricePerM2: safeDiv(asking, gbo),
    totalInvestmentPerM2: safeDiv(totalInvestmentWithStrategy, gbo),
    maximumBidPerM2: safeDiv(effectiveMaxBid, gbo),
    totalCostsPerM2: safeDiv(totals.total, gbo),
    salePricePerM2,
    netSaleProceedsPerM2,
    netMarginPerM2,
    annualRentPerM2: safeDiv(correctedAnnual, gbo),
    noiPerM2: safeDiv(noi, gbo),
    strategyEnabled: strategy.enabled,
    strategyMix: strategy.mix,
    holdValue: strategy.holdValue,
    saleNetProceedsUnits: strategy.netSaleProceeds,
    scenarioValue: strategy.scenarioValue,
    scenarioResultAtAsking,
    scenarioMarginPct,
    maxPurchasePrice,
    roundsAtAsking,
    leadingMaxBasis,
    leadingMaxBasisLabel,
    leadingMaxValue,
    leadingDifferenceWithAskingPrice,
    leadingRoundsAtAsking,
    leadingValuationTrackChoice: trackChoice,
    leadingMaxBasisOverridden,
    ovbPerComponent: ovb.perComponent,
    ovbMissingBasisCount: ovb.missingBasisCount,
    strategyPerUnit: strategy.perUnit.map((p) => ({
      unitId: p.unitId, label: p.label, type: p.type, strategy: p.strategy,
      contribution: p.contribution, warnings: p.warnings,
    })),
  };
}

