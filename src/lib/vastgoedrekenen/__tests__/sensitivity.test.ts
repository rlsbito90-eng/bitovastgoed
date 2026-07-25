import { describe, expect, it } from 'vitest';
import {
  applySensitivityAdjustment,
  scaleScenarioDevelopmentCosts,
  scaleScenarioRevenue,
  scaleStrategyDevelopmentCosts,
  scaleStrategyRevenue,
} from '../sensitivity';
import type { Scenario, ScenarioCost, SellOffUnit } from '../types';

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
