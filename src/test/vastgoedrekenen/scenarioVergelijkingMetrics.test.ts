import { describe, expect, it } from 'vitest';
import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';
import { getComparisonSummary, getDevelopmentComparisonMetrics, getTargetProfitLabel } from '@/components/vastgoedrekenen/ScenarioVergelijking';

function outputWithResidual(): ComputedOutputs {
  return {
    assessmentType: 'verkoop',
    strategyEnabled: true,
    saleHasInput: true,
    grossSaleProceeds: 4_000_000,
    netSaleProceeds: 3_940_000,
    saleNetProceedsUnits: 3_940_000,
    leadingMaxValue: 1_815_770,
    totalCosts: 2_000_000,
    totalInvestment: 121_910,
    netMargin: null,
    roi: null,
    scoreLabel: 'Residueel bepaald',
    leadingMaxBasisLabel: 'Componentstrategie',
    residual: {
      source: 'componentstrategie',
      grossDevelopmentValue: 4_000_000,
      componentDispositionCosts: 60_000,
      componentDevelopmentCosts: 1_000_000,
      sharedScenarioCosts: 121_910,
      financingCosts: 80_000,
      targetProfitAmount: 600_000,
      bindingTarget: 'winst_op_gdv',
      allowedTotalInvestment: 3_400_000,
      maxPurchasePrice: 1_815_770,
      transferTaxAtMaxPurchase: 188_840,
      acquisitionCostsAtMaxPurchase: 193_480,
      totalInvestmentAtMaxPurchase: 3_400_000,
      profitAtMaxPurchase: 600_000,
      profitOnCostPct: 17.65,
      profitOnGdvPct: 15,
      status: 'voor_bieding',
      criticalIssues: [],
      warnings: [],
      iterations: 20,
      converged: true,
    },
  } as unknown as ComputedOutputs;
}

describe('scenariovergelijking ontwikkel-KPI’s', () => {
  it('gebruikt de controleerbare residuele uitkomst in plaats van de lege huidige investering', () => {
    const metrics = getDevelopmentComparisonMetrics(outputWithResidual());
    expect(metrics.complete).toBe(true);
    expect(metrics.maxPurchasePrice).toBe(1_815_770);
    expect(metrics.grossDevelopmentValue).toBe(4_000_000);
    expect(metrics.netDevelopmentProceeds).toBe(3_940_000);
    expect(metrics.nonAcquisitionCosts).toBe(1_261_910);
    expect(metrics.totalInvestment).toBe(3_400_000);
    expect(metrics.profit).toBe(600_000);
    expect(metrics.profitOnGdvPct).toBe(15);
    expect(metrics.profitOnCostPct).toBe(17.65);
    expect(metrics.bindingKey).toBe('winst_op_gdv');
  });

  it('presenteert een nulkoopsom niet als een echte waarde', () => {
    const outputs = outputWithResidual();
    outputs.residual = { ...outputs.residual!, maxPurchasePrice: 0, criticalIssues: ['Geen positieve koopsom.'] };
    const metrics = getDevelopmentComparisonMetrics(outputs);
    expect(metrics.complete).toBe(false);
    expect(metrics.maxPurchasePrice).toBeNull();
  });

  it('maakt de leidende doelwinstgrondslag expliciet zichtbaar', () => {
    const outputs = outputWithResidual();
    const scenario = { sale_target_margin_percentage: 15 } as unknown as Scenario;
    expect(getTargetProfitLabel(scenario, outputs)).toBe('15% van GDV');

    outputs.residual = {
      ...outputs.residual!,
      bindingTarget: 'winst_op_kosten',
      profitOnCostPct: 10,
      targetProfitAmount: 340_000,
    };
    const costScenario = { sale_target_roi_percentage: 10 } as unknown as Scenario;
    expect(getTargetProfitLabel(costScenario, outputs)).toBe('10% op kosten');
  });

  it("maakt een voorlopige samenvatting voor twee GDV-scenario's en sluit winst op kosten uit", () => {
    const base = outputWithResidual();
    const cautious = outputWithResidual();
    cautious.residual = {
      ...cautious.residual!,
      maxPurchasePrice: 1_633_646,
      targetProfitAmount: 800_000,
      totalInvestmentAtMaxPurchase: 3_200_000,
      profitAtMaxPurchase: 800_000,
      profitOnGdvPct: 20,
      profitOnCostPct: 25,
      status: 'indicatief',
    };
    const costBased = outputWithResidual();
    costBased.residual = {
      ...costBased.residual!,
      bindingTarget: 'winst_op_kosten',
      maxPurchasePrice: 983_096,
      profitAtMaxPurchase: 363_637,
      profitOnGdvPct: 9.1,
      profitOnCostPct: 10,
    };

    const summary = getComparisonSummary([
      { scenario: { id: 'base', scenario_name: 'Basis 15%', sale_target_margin_percentage: 15 } as never, outputs: base },
      { scenario: { id: 'cautious', scenario_name: 'Voorzichtig 20%', sale_target_margin_percentage: 20 } as never, outputs: cautious },
      { scenario: { id: 'cost', scenario_name: 'Kosten 10%', sale_target_roi_percentage: 10 } as never, outputs: costBased },
    ]);

    expect(summary?.basisLabel).toBe('Winst op GDV');
    expect(summary?.count).toBe(2);
    expect(summary?.excludedCount).toBe(1);
    expect(summary?.definitive).toBe(false);
    expect(summary?.byBid.scenario.scenario_name).toBe('Basis 15%');
    expect(summary?.byProfit.scenario.scenario_name).toBe('Voorzichtig 20%');
    expect(summary?.bidSpread).toBe(182_124);
  });

});
