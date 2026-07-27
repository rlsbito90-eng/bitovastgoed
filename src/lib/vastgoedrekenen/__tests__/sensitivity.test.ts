import { describe, expect, it } from 'vitest';
import {
  applySensitivityAdjustment,
  computeSensitivityScenario,
  scaleScenarioDevelopmentCosts,
  scaleScenarioRevenue,
  scaleStrategyDevelopmentCosts,
  scaleStrategyRevenue,
} from '../sensitivity';
import { computeScenario } from '../compute';
import { buildScenarioComputeContext } from '../computeContext';
import type { AcquisitionComponent } from '../acquisition';
import type { Component, Scenario, ScenarioCost, SellOffUnit } from '../types';

const scenario = {
  id: 'scenario-1',
  sale_price_total: 4_000_000,
  sale_price_per_m2: null,
  sale_exit_value_manual: null,
} as unknown as Scenario;

const cost = {
  id: 'cost-1',
  calc_mode: 'totaal',
  amount: 500_000,
  vat_treatment: 'percentage',
} as unknown as ScenarioCost;

const unit = {
  id: 'unit-1',
  sale_price_total: 1_000_000,
  transformation_costs: 250_000,
} as unknown as SellOffUnit;

describe('sensitivity adjustments', () => {
  it('schaalt scenario-opbrengst zonder het origineel te muteren', () => {
    const adjusted = scaleScenarioRevenue(scenario, -10) as unknown as Record<string, unknown>;
    expect(adjusted.sale_price_total).toBe(3_600_000);
    expect((scenario as unknown as Record<string, unknown>).sale_price_total).toBe(4_000_000);
  });

  it('schaalt alleen de actieve algemene kostenbasis', () => {
    const adjusted = scaleScenarioDevelopmentCosts([cost], 10)[0] as unknown as Record<string, unknown>;
    expect(adjusted.amount).toBe(550_000);
  });

  it('schaalt strategie-opbrengst en ontwikkelkosten afzonderlijk', () => {
    const revenue = scaleStrategyRevenue([unit], 5)[0] as unknown as Record<string, unknown>;
    const costs = scaleStrategyDevelopmentCosts([unit], -10)[0] as unknown as Record<string, unknown>;
    expect(revenue.sale_price_total).toBe(1_050_000);
    expect(revenue.transformation_costs).toBe(250_000);
    expect(costs.transformation_costs).toBe(225_000);
    expect(costs.sale_price_total).toBe(1_000_000);
  });

  it('past beide assen gecombineerd toe', () => {
    const adjusted = applySensitivityAdjustment(scenario, [cost], [unit], {
      revenuePct: -10,
      developmentCostsPct: 10,
    });
    expect((adjusted.scenario as unknown as Record<string, unknown>).sale_price_total).toBe(3_600_000);
    expect((adjusted.costs[0] as unknown as Record<string, unknown>).amount).toBe(550_000);
    expect((adjusted.strategyUnits[0] as unknown as Record<string, unknown>).sale_price_total).toBe(900_000);
    expect((adjusted.strategyUnits[0] as unknown as Record<string, unknown>).transformation_costs).toBe(275_000);
  });
});

const parityScenario = {
  ...scenario,
  purchase_price: 1_000_000,
  asking_price: 1_050_000,
  ovb_mode: 'per_component',
  strategy_type: 'buy_transform_sell',
  sale_strategy: 'verkoop_per_unit',
  bid_basis: 'verkoop',
  target_bar: 6,
  current_monthly_rent: 0,
  market_monthly_rent: 0,
  notary_costs: 0,
  broker_costs: 0,
  due_diligence_costs: 0,
  safety_margin: 0,
  financing_costs: 0,
  sale_target_margin_percentage: 10,
  sale_target_roi_percentage: 12,
} as unknown as Scenario;

const legacyComponents = [
  {
    id: 'legacy-a',
    scenario_id: 'scenario-1',
    component_name: 'Legacy A',
    component_type: 'woning',
    allocated_component_value: 600_000,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: 'woning_belegging',
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    transfer_tax_manual_override: false,
    surface_gbo: 60,
  },
  {
    id: 'legacy-b',
    scenario_id: 'scenario-1',
    component_name: 'Legacy B',
    component_type: 'woning',
    allocated_component_value: 400_000,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: 'woning_belegging',
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    transfer_tax_manual_override: false,
    surface_gbo: 40,
  },
] as unknown as Component[];

function acquisition(
  id: string,
  value: number,
  classification: AcquisitionComponent['transfer_tax_classification'],
): AcquisitionComponent {
  return {
    id,
    scenario_id: 'scenario-1',
    component_name: id,
    component_type: classification === 'niet_woning' ? 'horeca' : 'appartement',
    floor_or_location: null,
    surface_gbo: null,
    surface_vvo: null,
    surface_bvo: null,
    allocated_component_value: value,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: classification,
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    transfer_tax_manual_override: false,
    source_note: null,
    reliability_status: null,
    notes: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
  };
}

const parityAcquisitionComponents = [
  acquisition('acquisition-home', 600_000, 'woning_belegging'),
  acquisition('acquisition-commercial', 400_000, 'niet_woning'),
];

const parityCost = {
  ...cost,
  amount: 100_000,
  calc_mode: 'totaal',
} as unknown as ScenarioCost;

const parityUnit = {
  ...unit,
  strategy: 'transformeren_verkopen',
  sale_price_source: 'totaal',
  sale_price_total: 2_000_000,
  sale_costs_pct: 1.5,
  transformation_costs: 200_000,
} as unknown as SellOffUnit;

function parityContext(acquisitionComponents = parityAcquisitionComponents) {
  return buildScenarioComputeContext({
    scenario: parityScenario,
    components: legacyComponents,
    acquisitionComponents,
    costs: [parityCost],
    wwsUnits: [],
    strategyUnits: [parityUnit],
    taxSettings: null,
    objectType: 'mixed_use',
    objectArea: 100,
    propertyType: 'mixed_use',
  });
}

describe('gevoeligheidsanalyse gebruikt de centrale computecontext', () => {
  it('maakt de basiscel exact gelijk aan de normale scenarioberekening', () => {
    const context = parityContext();

    expect(computeSensitivityScenario(context, {
      revenuePct: 0,
      developmentCostsPct: 0,
    })).toEqual(computeScenario(context));
  });

  it('neemt acquisitionComponents mee in de gevoeligheidsuitkomst', () => {
    const current = computeSensitivityScenario(parityContext(), {
      revenuePct: 0,
      developmentCostsPct: 0,
    });
    const legacy = computeSensitivityScenario(parityContext([]), {
      revenuePct: 0,
      developmentCostsPct: 0,
    });

    expect(current.totalTransferTax).toBe(89_600);
    expect(legacy.totalTransferTax).toBe(80_000);
  });

  it('neemt strategyUnits mee in de gevoeligheidsuitkomst', () => {
    const result = computeSensitivityScenario(parityContext(), {
      revenuePct: 0,
      developmentCostsPct: 0,
    });

    expect(result.strategyEnabled).toBe(true);
    expect(result.scenarioValue).toBeGreaterThan(0);
    expect(result.roi).not.toBeNull();
  });

  it('muteert de oorspronkelijke computecontext niet', () => {
    const context = parityContext();
    const before = structuredClone(context);

    computeSensitivityScenario(context, {
      revenuePct: -10,
      developmentCostsPct: 10,
    });

    expect(context).toEqual(before);
  });
});
