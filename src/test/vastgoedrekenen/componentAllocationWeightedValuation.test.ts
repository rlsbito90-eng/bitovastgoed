import { describe, expect, it } from 'vitest';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { aggregateStrategy, computeComponentStrategy } from '@/lib/vastgoedrekenen/componentStrategy';
import { resolveComponentAllocationWeighting } from '@/lib/vastgoedrekenen/componentAllocationWeighting';

function unit(overrides: Record<string, unknown> = {}): SellOffUnit {
  return {
    id: 'unit-1',
    scenario_id: 'scenario-1',
    component_id: 'component-1',
    unit_name: 'Woningen',
    unit_label: 'Woningen',
    unit_type: 'woning',
    strategy: 'verkopen_leeg',
    sale_price_source: 'totaal',
    sale_price_total: 1_000_000,
    sale_costs_pct: 10,
    legal_costs: 10_000,
    renovation_costs: 100_000,
    sort_order: 0,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    ...overrides,
  } as unknown as SellOffUnit;
}

describe('allocatiegewogen componentwaardering', () => {
  it('behoudt legacyregels zonder allocatie exact op 100%', () => {
    const legacy = unit({ allocation_percentage: null });
    const raw = computeComponentStrategy(legacy);
    const totals = aggregateStrategy([legacy]);

    expect(totals.scenarioValue).toBe(raw.contribution);
    expect(totals.grossDevelopmentValue).toBe(raw.breakdown.grossSaleValue);
    expect(totals.componentDispositionCosts).toBe(
      raw.breakdown.saleCosts + raw.breakdown.legalCosts,
    );
    expect(totals.extraInvestmentCosts).toBe(raw.extraInvestmentCosts);
    expect(totals.warnings.some((warning) => warning.includes('ongewogen rekenwijze'))).toBe(false);
  });

  it('voorkomt dubbele telling bij een complete 50/50-splitsing', () => {
    const first = unit({ id: 'sale-a', allocation_percentage: 50 });
    const second = unit({ id: 'sale-b', allocation_percentage: 50, unit_label: 'Woningen — deel 2' });
    const totals = aggregateStrategy([first, second]);

    expect(totals.perUnit.map((result) => result.contribution)).toEqual([445_000, 445_000]);
    expect(totals.netSaleProceeds).toBe(890_000);
    expect(totals.grossDevelopmentValue).toBe(1_000_000);
    expect(totals.componentDispositionCosts).toBe(110_000);
    expect(totals.componentDevelopmentCosts).toBe(100_000);
    expect(totals.extraInvestmentCosts).toBe(100_000);
    expect(totals.scenarioValue).toBe(890_000);
  });

  it('weegt een complete verkoop- en aanhoudmix inclusief kosten', () => {
    const sale = unit({
      id: 'sale',
      allocation_percentage: 60,
      renovation_costs: 100_000,
    });
    const hold = unit({
      id: 'hold',
      allocation_percentage: 40,
      strategy: 'renoveren_aanhouden',
      sale_price_total: null,
      sale_costs_pct: null,
      legal_costs: null,
      renovation_costs: 50_000,
      hold_annual_rent: 60_000,
      hold_valuation_method: 'BAR',
      hold_bar: 6,
    });

    const totals = aggregateStrategy([sale, hold]);

    expect(totals.perUnit.find((result) => result.unitId === 'sale')?.contribution).toBe(534_000);
    expect(totals.perUnit.find((result) => result.unitId === 'hold')?.contribution).toBe(400_000);
    expect(totals.netSaleProceeds).toBe(534_000);
    expect(totals.holdValue).toBe(400_000);
    expect(totals.scenarioValue).toBe(934_000);
    expect(totals.grossDevelopmentValue).toBe(1_000_000);
    expect(totals.componentDispositionCosts).toBe(66_000);
    expect(totals.componentDevelopmentCosts).toBe(80_000);
    expect(totals.extraInvestmentCosts).toBe(80_000);
  });

  it('laat een onderverdeelde groep ongewogen totdat exact 100% is toegewezen', () => {
    const first = unit({ id: 'under-a', allocation_percentage: 40 });
    const second = unit({ id: 'under-b', allocation_percentage: 40 });
    const rawContribution = computeComponentStrategy(first).contribution;
    const totals = aggregateStrategy([first, second]);

    expect(totals.scenarioValue).toBe(rawContribution * 2);
    expect(totals.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('onderverdeeld (80%)'),
      expect.stringContaining('ongewogen rekenwijze'),
    ]));
  });

  it('laat ook een enkele 50%-regel ongewogen en zichtbaar onvolledig', () => {
    const partial = unit({ allocation_percentage: 50 });
    const raw = computeComponentStrategy(partial);
    const totals = aggregateStrategy([partial]);
    const weighting = resolveComponentAllocationWeighting([partial]);

    expect(totals.scenarioValue).toBe(raw.contribution);
    expect(weighting.byUnitId.get(partial.id)?.effectiveWeight).toBe(1);
    expect(weighting.groups[0]).toMatchObject({
      totalAllocationPercentage: 50,
      status: 'underallocated',
    });
  });

  it('laat een oververdeelde groep ongewogen en waarschuwt voor 120%', () => {
    const first = unit({ id: 'over-a', allocation_percentage: 60 });
    const second = unit({ id: 'over-b', allocation_percentage: 60 });
    const rawContribution = computeComponentStrategy(first).contribution;
    const totals = aggregateStrategy([first, second]);

    expect(totals.scenarioValue).toBe(rawContribution * 2);
    expect(totals.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('oververdeeld (120%)'),
      expect.stringContaining('ongewogen rekenwijze'),
    ]));
  });

  it('weegt de per-unit bruto waarde die computeScenario als OVB-verdeelsleutel gebruikt', () => {
    const first = unit({ id: 'ovb-a', allocation_percentage: 25 });
    const second = unit({ id: 'ovb-b', allocation_percentage: 75 });
    const totals = aggregateStrategy([first, second]);

    expect(totals.perUnit.find((result) => result.unitId === 'ovb-a')?.breakdown.grossSaleValue)
      .toBe(250_000);
    expect(totals.perUnit.find((result) => result.unitId === 'ovb-b')?.breakdown.grossSaleValue)
      .toBe(750_000);
  });
});
