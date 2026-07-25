import { describe, expect, it } from 'vitest';
import { buildOutcomeExplanation } from '@/lib/vastgoedrekenen/outcomeExplanation';
import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';

function baseOutputs(overrides: Partial<ComputedOutputs> = {}): ComputedOutputs {
  return {
    totalTransferTax: 0,
    totalAcquisitionCosts: 0,
    totalCosts: 0,
    totalInvestment: 0,
    currentAnnualRent: 0,
    marketAnnualRent: 0,
    wwsCorrectedAnnualRent: 0,
    correctedAnnualRent: 0,
    noi: 0,
    noiMargin: null,
    totalCorrectionPct: 0,
    vacancyCorrectionEur: 0,
    operatingCostsEur: 0,
    maintenanceCostsEur: 0,
    managementCostsEur: 0,
    otherCostsEur: 0,
    pricePerM2Gbo: null,
    barPurchasePrice: null,
    barTotalInvestment: null,
    factorPurchasePrice: null,
    factorTotalInvestment: null,
    narTotalInvestment: null,
    maximumAllInValue: 0,
    maximumBid: 0,
    conservativeBid: 0,
    realisticBid: 0,
    aggressiveBid: 0,
    notInterestingAbove: 0,
    differenceWithAskingPrice: 0,
    requiredDiscount: 0,
    dealScore: 'C',
    riskScore: 'middel',
    complexityScore: 'middel',
    inputReliability: 'middel',
    assessmentType: 'verkoop',
    scoreLabel: 'Onzeker',
    scoreReason: '',
    scorePositivePoints: [],
    scoreAttentionPoints: [],
    conclusion: '',
    recommendedNextStep: '',
    warnings: [],
    saleHasInput: false,
    grossSaleProceeds: null,
    saleCostsTotal: null,
    netSaleProceeds: null,
    grossMargin: null,
    netMargin: null,
    roi: null,
    exitValue: null,
    saleVsPurchase: null,
    saleVsTotalInvestment: null,
    exitBasedMaxBid: null,
    exitBidBindingTarget: null,
    bidBasisUsed: 'huur',
    purchasePricePerM2: null,
    askingPricePerM2: null,
    totalInvestmentPerM2: null,
    maximumBidPerM2: null,
    totalCostsPerM2: null,
    salePricePerM2: null,
    netSaleProceedsPerM2: null,
    netMarginPerM2: null,
    annualRentPerM2: null,
    noiPerM2: null,
    strategyEnabled: false,
    strategyMix: '',
    holdValue: 0,
    saleNetProceedsUnits: 0,
    scenarioValue: 0,
    scenarioResultAtAsking: null,
    scenarioMarginPct: null,
    maxPurchasePrice: null,
    residual: null,
    roundsAtAsking: null,
    leadingMaxBasis: 'huur',
    leadingMaxBasisLabel: 'Huur / BAR',
    leadingMaxValue: 0,
    leadingDifferenceWithAskingPrice: 0,
    leadingRoundsAtAsking: null,
    leadingValuationTrackChoice: 'auto',
    leadingMaxBasisOverridden: false,
    ovbPerComponent: [],
    ovbMissingBasisCount: 0,
    strategyPerUnit: [],
    ...overrides,
  };
}

describe('uitkomstverklaring', () => {
  it('splitst een residuele koopsom in doelwinst en overige kosten', () => {
    const outputs = baseOutputs({
      assessmentType: 'verkoop',
      strategyEnabled: true,
      residual: {
        source: 'componentstrategie',
        grossDevelopmentValue: 4_000_000,
        componentDispositionCosts: 60_000,
        componentDevelopmentCosts: 900_000,
        sharedScenarioCosts: 200_000,
        financingCosts: 100_000,
        targetProfitAmount: 600_000,
        bindingTarget: 'winst_op_gdv',
        allowedTotalInvestment: 3_400_000,
        maxPurchasePrice: 1_915_000,
        transferTaxAtMaxPurchase: 200_000,
        acquisitionCostsAtMaxPurchase: 25_000,
        totalInvestmentAtMaxPurchase: 3_400_000,
        profitAtMaxPurchase: 600_000,
        profitOnCostPct: 17.65,
        profitOnGdvPct: 15,
        status: 'indicatief',
        criticalIssues: [],
        warnings: [],
        iterations: 20,
        converged: true,
      },
    });

    const result = buildOutcomeExplanation({} as Scenario, outputs);
    expect(result?.track).toBe('residueel');
    expect(result?.bindingLabel).toBe('Winst op GDV');
    expect(result?.stages[0].resultValue).toBe(3_400_000);
    expect(result?.stages[1].resultValue).toBe(1_915_000);
    expect(result?.stages[1].roundingDifference).toBe(0);
    expect(result?.stages[1].lines.find((line) => line.id === 'component-development-costs')?.value).toBe(900_000);
  });

  it('verklaart een exploitatiebieding via NOI en doel-BAR', () => {
    const scenario = {
      rent_source: 'componenten',
      target_bar: 6,
      financing_costs: 30_000,
    } as Scenario;
    const outputs = baseOutputs({
      assessmentType: 'exploitatie',
      correctedAnnualRent: 100_000,
      vacancyCorrectionEur: 5_000,
      operatingCostsEur: 7_000,
      maintenanceCostsEur: 4_000,
      managementCostsEur: 3_000,
      otherCostsEur: 1_000,
      noi: 80_000,
      maximumAllInValue: 1_333_333,
      totalTransferTax: 80_000,
      totalAcquisitionCosts: 20_000,
      totalCosts: 100_000,
      maximumBid: 1_103_333,
    });

    const result = buildOutcomeExplanation(scenario, outputs);
    expect(result?.track).toBe('exploitatie');
    expect(result?.bindingLabel).toBe('Doel-BAR 6%');
    expect(result?.stages[0].resultValue).toBe(80_000);
    expect(result?.stages[1].resultValue).toBe(1_103_333);
    expect(result?.stages[1].roundingDifference).toBe(0);
  });

  it('verklaart een verkoopbieding zonder residuele componentstrategie', () => {
    const scenario = { financing_costs: 100_000 } as Scenario;
    const outputs = baseOutputs({
      assessmentType: 'verkoop',
      saleHasInput: true,
      grossSaleProceeds: 2_000_000,
      saleCostsTotal: 100_000,
      netSaleProceeds: 1_900_000,
      exitValue: 1_900_000,
      exitBidBindingTarget: 'marge_pct',
      bidBasisUsed: 'verkoop',
      totalTransferTax: 80_000,
      totalAcquisitionCosts: 20_000,
      totalCosts: 500_000,
      maximumBid: 1_200_000,
    });

    const result = buildOutcomeExplanation(scenario, outputs);
    expect(result?.track).toBe('verkoop');
    expect(result?.bindingLabel).toBe('Winst op GDV');
    expect(result?.stages[0].resultValue).toBe(1_900_000);
    expect(result?.stages[1].resultValue).toBe(1_200_000);
    expect(result?.stages[1].roundingDifference).toBe(0);
  });
});
