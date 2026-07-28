import { describe, expect, it } from 'vitest';
import type { Scenario, ScenarioCost, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { buildScenarioUnleveredCashflow } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';

function scenario(patch: Record<string, unknown> = {}): Scenario {
  return {
    id: 'scenario-1',
    calculation_id: 'calculation-1',
    object_id: 'object-1',
    scenario_name: 'Testscenario',
    status: 'concept',
    strategy_type: 'buy_transform_sell',
    purchase_price: 1_000_000,
    financing_costs: 10_000,
    unforeseen_percentage: 0,
    ...patch,
  } as unknown as Scenario;
}

function unit(patch: Record<string, unknown> = {}): SellOffUnit {
  return {
    id: 'unit-1',
    scenario_id: 'scenario-1',
    component_id: 'component-1',
    unit_name: 'Transformatie',
    unit_label: 'Transformatie',
    unit_type: 'woning',
    strategy: 'transformeren_verkopen',
    sale_price_source: 'totaal',
    sale_price_total: 1_500_000,
    sale_costs_pct: 10,
    legal_costs: 10_000,
    transformation_costs: 120_000,
    development_start_month: 0,
    development_end_month: 11,
    expected_sale_period_months: 18,
    allocation_percentage: 100,
    allocation_timing_schema_version: 1,
    sort_order: 0,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    ...patch,
  } as unknown as SellOffUnit;
}

function cost(patch: Record<string, unknown> = {}): ScenarioCost {
  return {
    id: 'cost-1',
    scenario_id: 'scenario-1',
    cost_category: 'Advieskosten',
    description: 'Architect en adviseurs',
    amount: 60_000,
    calc_mode: 'totaal',
    vat_treatment: 'geen',
    vat_applicable: false,
    reliability_status: 'hoog',
    notes: 'Begroting',
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    cashflow_timing_method: 'single',
    cashflow_payment_month: 3,
    cashflow_timing_schema_version: 1,
    ...patch,
  } as unknown as ScenarioCost;
}

const savedOutput = {
  total_transfer_tax: 80_000,
  total_acquisition_costs: 20_000,
  total_costs: 60_000,
  total_investment: 1_290_000,
};

describe('ongefinancierde scenariokasstroom', () => {
  it('combineert acquisitie, algemene kosten en componentkasstromen zonder financiering dubbel te tellen', () => {
    const result = buildScenarioUnleveredCashflow({
      scenario: scenario(),
      costs: [cost()],
      strategyUnits: [unit()],
      timeHorizonMonths: 24,
      savedOutput,
    });

    expect(result.readyForPeriodicCashflow).toBe(true);
    expect(result.readyForDiscounting).toBe(true);
    expect(result.monthly[0]).toMatchObject({
      purchasePrice: 1_000_000,
      transferTax: 80_000,
      acquisitionCosts: 20_000,
    });
    expect(result.monthly[3].sharedScenarioCosts).toBe(60_000);
    expect(result.monthly[18]).toMatchObject({
      grossSaleProceeds: 1_500_000,
      dispositionCosts: 160_000,
    });
    expect(result.totals).toMatchObject({
      purchasePrice: 1_000_000,
      transferTax: 80_000,
      acquisitionCosts: 20_000,
      componentDevelopmentCosts: 120_000,
      sharedScenarioCosts: 60_000,
      grossSaleProceeds: 1_500_000,
      dispositionCosts: 160_000,
      netCashflow: 60_000,
    });
    expect(result.reconciliation).toEqual({
      expectedUnleveredInvestment: 1_280_000,
      reportedUnleveredInvestment: 1_280_000,
      difference: 0,
      reconciled: true,
    });
    expect(result.warnings.join(' ')).toMatch(/financieringskosten.*niet opgenomen/i);
  });

  it('verdeelt algemene kosten lineair en behoudt exact het bestaande kostentotaal', () => {
    const result = buildScenarioUnleveredCashflow({
      scenario: scenario({ financing_costs: 0 }),
      costs: [cost({
        amount: 120_000,
        cashflow_timing_method: 'linear',
        cashflow_start_month: 1,
        cashflow_end_month: 12,
        cashflow_payment_month: null,
      })],
      strategyUnits: [unit()],
      timeHorizonMonths: 24,
      savedOutput: {
        ...savedOutput,
        total_costs: 120_000,
        total_investment: 1_340_000,
      },
    });

    expect(result.readyForPeriodicCashflow).toBe(true);
    expect(result.monthly.slice(1, 13).every((row) => row.sharedScenarioCosts === 10_000)).toBe(true);
    expect(result.totals.sharedScenarioCosts).toBe(120_000);
    expect(result.reconciliation?.reconciled).toBe(true);
  });

  it('blokkeert de volledige projecttijdlijn zolang een positieve algemene kostenpost geen timing heeft', () => {
    const result = buildScenarioUnleveredCashflow({
      scenario: scenario(),
      costs: [cost({
        cashflow_timing_method: null,
        cashflow_start_month: null,
        cashflow_end_month: null,
        cashflow_payment_month: null,
        cashflow_timing_schema_version: null,
      })],
      strategyUnits: [unit()],
      timeHorizonMonths: 24,
      savedOutput,
    });

    expect(result.readyForPeriodicCashflow).toBe(false);
    expect(result.monthly).toEqual([]);
    expect(result.blockers.join(' ')).toMatch(/kasstroomtiming is nog niet vastgelegd/i);
  });
});
