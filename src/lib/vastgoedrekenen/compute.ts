// Orchestrator die alle Vastgoedrekenen-berekeningen samenbrengt
// voor één scenario. Pure function — geen DB-calls.

import type { Component, Scenario, ScenarioCost, WwsUnit, TaxSettings, ComputedOutputs, SellOffUnit } from './types';
import { computeScenarioOvb } from './ovb';
import {
  annualFromMonthly, getWwsCorrectedAnnualRent, pickCorrectedAnnualRent, bar as fnBar, factor as fnFactor,
} from './huur';
import {
  computeAcquisitionCosts,
  computeTotalCosts,
  computeTotalInvestment,
  effectiveCostAmount,
  pricePerM2,
} from './investering';
import { computeBidAdvice } from './bieding';
import { computeInputReliability, computeRiskScore, computeComplexity, computeDealScore, computeSaleScenarioScore, determineAssessmentType } from './scores';
import { buildConclusion, buildNextStep } from './conclusie';
import { getAssumptionSet, type PropertyAssumptionType } from './profiles';
import { computeSale } from './verkoop';
import {
  aggregateStrategy,
  HOLD_STRATEGIES,
  SALE_STRATEGIES,
  type ComponentStrategyKey,
} from './componentStrategy';
import { computeResidualBid } from './residueel';

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
    // Alleen als verdeelsleutel voor OVB: bruto terminale waarde, niet als fiscale grondslag.
    const isSale = res.strategy != null && SALE_STRATEGIES.includes(res.strategy);
    const v = Math.max(0, Math.round(
      isSale ? res.breakdown.grossSaleValue : (res.breakdown.holdValue || res.contribution),
    ));
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
  // Alle componentontwikkelkosten horen bij de investering. Ze worden niet
  // gesaldeerd met de verkoopopbrengst.
  const totalInvestmentWithStrategy = strategy.enabled
    ? totalInvestment + strategy.extraInvestmentCosts
    : totalInvestment;

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
  const sale = computeSale(scenario, totalInvestmentWithStrategy, purchase);

  // Componentstrategie is een volwaardige opbrengstbron. Ontwikkelkosten staan
  // aan de investeringszijde; netto verkoopopbrengst bevat alleen aftrek van
  // verkoop- en juridische kosten.
  const strategySaleResults = strategy.perUnit.filter(
    (result) => result.strategy != null && SALE_STRATEGIES.includes(result.strategy),
  );
  const strategyGrossSaleProceeds = strategySaleResults.reduce(
    (sum, result) => sum + result.breakdown.grossSaleValue,
    0,
  );
  const strategyHasTerminalValue = strategy.enabled && strategy.grossDevelopmentValue > 0;
  const strategyHasSale = strategySaleResults.length > 0;
  const strategyNetMargin = strategyHasTerminalValue && purchase > 0 && totalInvestmentWithStrategy > 0
    ? strategy.scenarioValue - totalInvestmentWithStrategy
    : null;
  const strategyRoi = strategyNetMargin != null && totalInvestmentWithStrategy > 0
    ? Number(((strategyNetMargin / totalInvestmentWithStrategy) * 100).toFixed(2))
    : null;

  const reportedSaleHasInput = strategy.enabled ? strategyHasTerminalValue : sale.hasAnySaleInput;
  const reportedGrossSaleProceeds = strategy.enabled
    ? (strategyHasSale ? strategyGrossSaleProceeds : null)
    : sale.grossSaleProceeds;
  const reportedSaleCostsTotal = strategy.enabled
    ? (strategyHasSale ? strategy.componentDispositionCosts : null)
    : sale.saleCostsTotal;
  const reportedNetSaleProceeds = strategy.enabled
    ? (strategyHasSale ? strategy.netSaleProceeds : null)
    : sale.netSaleProceeds;
  const reportedExitValue = strategy.enabled
    ? (strategyHasTerminalValue ? strategy.scenarioValue : null)
    : sale.exitValue;
  const reportedGrossMargin = strategy.enabled
    ? (strategyHasTerminalValue && purchase > 0
      ? strategy.grossDevelopmentValue - totalInvestmentWithStrategy
      : null)
    : sale.grossMargin;
  const reportedNetMargin = strategy.enabled ? strategyNetMargin : sale.netMargin;
  const reportedRoi = strategy.enabled ? strategyRoi : sale.roi;
  const reportedSaleVsPurchase = strategy.enabled
    ? (strategyHasTerminalValue && purchase > 0 ? strategy.grossDevelopmentValue - purchase : null)
    : sale.saleVsPurchase;
  const reportedSaleVsTotalInvestment = strategy.enabled
    ? strategyNetMargin
    : sale.saleVsTotalInvestment;

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
      netSaleProceeds: reportedNetSaleProceeds,
      exitValue: reportedExitValue,
      totalInvestment: totalInvestmentWithStrategy,
      netMargin: reportedNetMargin,
      roi: reportedRoi,
      maximumBid: effectiveMaxBid,
      askingPrice: asking,
      purchasePrice: purchase,
      targetRoi: Number(rec.sale_target_roi_percentage ?? 0),
      targetMarginAmount: Number(rec.sale_target_margin_amount ?? 0),
      targetMarginPercentage: Number(rec.sale_target_margin_percentage ?? 0),
      targetExitValue: Number(rec.sale_target_exit_value ?? 0),
      saleHasInput: reportedSaleHasInput,
      exitIsManual: !strategy.enabled && Number(rec.sale_exit_value_manual ?? 0) > 0,
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
  const strategySellableM2 = strategySaleResults.reduce((sum, result) => {
    const unit = (ctx.strategyUnits ?? []).find((candidate) => candidate.id === result.unitId);
    if (!unit) return sum;
    const record = unit as unknown as Record<string, unknown>;
    return sum + (
      Number(record.surface_gbo ?? 0)
      || Number(record.surface_vvo ?? 0)
      || Number(record.surface_bvo ?? 0)
    );
  }, 0);
  const sellableM2 = strategy.enabled
    ? (strategySellableM2 > 0 ? strategySellableM2 : null)
    : (Number((scenario as Record<string, unknown>).sale_sellable_m2 ?? 0) || null);
  const salePricePerM2 = reportedGrossSaleProceeds != null && sellableM2
    ? safeDiv(reportedGrossSaleProceeds, sellableM2)
    : null;
  const netSaleProceedsPerM2 = reportedNetSaleProceeds != null && sellableM2
    ? safeDiv(reportedNetSaleProceeds, sellableM2)
    : null;
  const netMarginPerM2 = reportedNetMargin != null && sellableM2
    ? safeDiv(reportedNetMargin, sellableM2)
    : null;

  // --- Componentstrategie en residuele maximale koopsom ---
  const scenarioResultAtAsking = strategy.enabled && asking > 0
    ? strategy.scenarioValue - (asking + ovb.totalOvb + acq.totalAcquisitionCosts + totals.total + financing + strategy.extraInvestmentCosts)
    : null;
  const scenarioMarginPct = strategy.enabled && scenarioResultAtAsking != null && totalInvestmentWithStrategy > 0
    ? Number(((scenarioResultAtAsking / totalInvestmentWithStrategy) * 100).toFixed(2))
    : null;

  const residualCriticalIssues: string[] = [];
  const residualWarnings: string[] = [];
  if (strategy.enabled) {
    for (const result of strategy.perUnit) {
      const strategyKey = result.strategy as ComponentStrategyKey | null;
      if (!strategyKey || strategyKey === 'later_beslissen') {
        residualCriticalIssues.push(`${result.label}: kies een definitieve componentstrategie.`);
        continue;
      }
      if (SALE_STRATEGIES.includes(strategyKey)) {
        if (result.breakdown.grossSaleValue <= 0) residualCriticalIssues.push(`${result.label}: verkoopwaarde ontbreekt.`);
        if (result.breakdown.saleCosts <= 0) residualCriticalIssues.push(`${result.label}: verkoopkosten ontbreken.`);
      }
      if (HOLD_STRATEGIES.includes(strategyKey) && result.breakdown.holdValue <= 0) {
        residualCriticalIssues.push(`${result.label}: terminale aanhoudwaarde ontbreekt.`);
      }
      if (
        (strategyKey === 'renoveren_verkopen' || strategyKey === 'renoveren_aanhouden')
        && result.breakdown.renovationCosts <= 0
      ) {
        residualCriticalIssues.push(`${result.label}: renovatiekosten ontbreken.`);
      }
      if (
        (
          strategyKey === 'transformeren_verkopen'
          || strategyKey === 'transformeren_aanhouden'
          || strategyKey === 'sloop_nieuwbouw_verkopen'
          || strategyKey === 'sloop_nieuwbouw_aanhouden'
        )
        && result.breakdown.transformationCosts <= 0
      ) {
        residualCriticalIssues.push(
          `${result.label}: ${
            strategyKey.startsWith('sloop_') ? 'sloop- en nieuwbouwkosten' : 'transformatiekosten'
          } ontbreken.`,
        );
      }
    }
    if (sale.hasAnySaleInput) {
      residualCriticalIssues.push('Scenario-exit en componentstrategie zijn beide actief; componentstrategie is residueel leidend.');
    }
  }

  if (costs.some((cost) => effectiveCostAmount(cost) > 0 && cost.reliability_status !== 'hoog')) {
    residualCriticalIssues.push('Niet alle algemene projectkosten hebben betrouwbaarheid hoog.');
  }

  if (scenario.ovb_mode === 'per_component') {
    if (components.length === 0) residualCriticalIssues.push('OVB per component is gekozen, maar componenten ontbreken.');
    for (const component of components) {
      if (!component.transfer_tax_classification) {
        residualCriticalIssues.push(`${component.component_name ?? 'Component'}: expliciete OVB-classificatie bij verkrijging ontbreekt.`);
      }
    }
  } else if (scenario.ovb_mode === 'manual') {
    if (scenario.transfer_tax_amount == null) residualCriticalIssues.push('Handmatig OVB-bedrag ontbreekt.');
  } else if (!scenario.ovb_classification && scenario.transfer_tax_percentage == null) {
    residualCriticalIssues.push('Expliciete OVB-classificatie of een onderbouwd OVB-percentage ontbreekt.');
  }

  const residualSource = strategy.enabled
    ? 'componentstrategie' as const
    : (sale.grossSaleProceeds != null || sale.exitValue != null ? 'scenario_exit' as const : null);
  if (residualSource === 'scenario_exit') {
    if (sale.grossSaleProceeds != null && (sale.saleCostsTotal ?? 0) <= 0) {
      residualCriticalIssues.push('Verkoopkosten ontbreken bij de scenario-exit.');
    }
    if (sale.grossSaleProceeds == null && sale.exitValue != null) {
      residualWarnings.push('De residuele opbrengstwaarde komt uit een handmatige exitwaarde; controleer of deze bruto of netto is ingevoerd.');
    }
  }
  const residual = residualSource
    ? computeResidualBid({
      scenario,
      components,
      taxSettings,
      objectType: ovbObjectType,
      source: residualSource,
      grossDevelopmentValue: strategy.enabled
        ? strategy.grossDevelopmentValue
        : (sale.grossSaleProceeds ?? sale.exitValue ?? 0),
      componentDispositionCosts: strategy.enabled
        ? strategy.componentDispositionCosts
        : (sale.saleCostsTotal ?? 0),
      componentDevelopmentCosts: strategy.enabled ? strategy.componentDevelopmentCosts : 0,
      sharedScenarioCosts: totals.total,
      financingCosts: financing,
      strategyValueByComponentId: strategy.enabled ? strategyValueByComponentId : undefined,
      criticalIssues: residualCriticalIssues,
      warnings: [
        ...residualWarnings,
        ...(strategy.enabled ? strategy.warnings : []),
      ],
    })
    : null;

  const maxPurchasePrice = residual?.maxPurchasePrice ?? null;
  const roundsAtAsking = asking > 0 && maxPurchasePrice != null
    ? maxPurchasePrice >= asking
    : null;

  if (
    strategy.enabled
    && strategy.componentDevelopmentCosts > 0
    && totals.total > 0
  ) {
    residual?.warnings.push('Componentkosten en algemene scenario-kosten tellen beide mee; controleer handmatig of geen invoer overlapt.');
  }

  // Leidende maximale prijs: standaard heuristiek (auto) plus expliciete override
  // via scenario.leading_valuation_track. Per spoor kiezen we de juiste onderliggende
  // waarde, zodat een handmatige keuze altijd zichtbaar doorwerkt — ook als die afwijkt
  // van de automatisch gekozen bid-basis.
  const trackChoice = ((scenario as unknown as Record<string, unknown>).leading_valuation_track as
    | 'auto' | 'huur_bar' | 'scenario_exit' | 'componentstrategie' | null | undefined) ?? 'auto';
  const huurMaxBid = bid.maxBid;
  const verkoopMaxBid = residual?.source === 'scenario_exit'
    ? residual.maxPurchasePrice
    : (exitBasedMaxBidNet != null ? exitBasedMaxBidNet : effectiveMaxBid);
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
  } else if (residual) {
    // Zonder referentieprijs is er geen "goedkoop/duur"-signaal. De residuele
    // maximumprijs is informatief of biedingsklaar op basis van invoercompleetheid.
    dealScore = 'C';
    scoreLabel = 'Residueel bepaald';
    scoreReason = 'Geen vraagprijs — maximale koopsom residueel bepaald.';
    scoreAttentionPoints = [
      ...residual.criticalIssues,
      ...residual.warnings,
      ...scoreAttentionPoints,
    ];
  }

  // --- Conclusie + next step (op basis van de uiteindelijke leading-aware score) ---
  let conclusion = buildConclusion({
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
    netSaleProceeds: reportedNetSaleProceeds,
    netMargin: reportedNetMargin,
    roi: reportedRoi,
    exitValue: reportedExitValue,
  });
  let nextStep = assessmentType === 'verkoop'
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
  if (asking <= 0 && residual) {
    conclusion = 'Geen vraagprijs — maximale koopsom residueel bepaald op basis van opbrengstwaarde, kosten en doelwinst.';
    nextStep = residual.status === 'voor_bieding'
      ? 'Controleer de onderbouwing en gebruik de residuele maximale koopsom als biedingsgrens.'
      : 'Vul de ontbrekende kerngegevens aan voordat de uitkomst als biedingsgrens wordt gebruikt.';
  }

  const combinedWarnings = strategy.enabled
    ? [...risk.flags, ...strategy.warnings, ...(residual?.warnings ?? [])]
    : [...risk.flags, ...(residual?.warnings ?? [])];

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
    saleHasInput: reportedSaleHasInput,
    grossSaleProceeds: reportedGrossSaleProceeds,
    saleCostsTotal: reportedSaleCostsTotal,
    netSaleProceeds: reportedNetSaleProceeds,
    grossMargin: reportedGrossMargin,
    netMargin: reportedNetMargin,
    roi: reportedRoi,
    exitValue: reportedExitValue,
    saleVsPurchase: reportedSaleVsPurchase,
    saleVsTotalInvestment: reportedSaleVsTotalInvestment,
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
    residual,
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
