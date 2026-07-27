import { describe, expect, it } from 'vitest';
import { assessInputReliability } from '@/lib/vastgoedrekenen/reliabilityAssessment';
import type { Component, Scenario, ScenarioCost, SellOffUnit } from '@/lib/vastgoedrekenen/types';

function input(overrides: Partial<Parameters<typeof assessInputReliability>[0]> = {}) {
  return {
    scenario: {
      strategy_type: 'buy_transform_sell',
      sale_strategy: 'transformeren_verkopen',
      sale_target_margin_percentage: 15,
      ovb_mode: 'per_component',
      assumptions_source: 'Interne haalbaarheidsanalyse, peildatum vastgelegd',
      assumptions_reliability: 'hoog',
    } as unknown as Scenario,
    components: [{ id: 'c1', component_name: 'Woning 1', component_type: 'woning' } as Component],
    costs: [{ id: 'k1', amount: 100_000, cost_category: 'Architect', reliability_status: 'hoog' } as ScenarioCost],
    wwsUnits: [],
    strategyUnits: [{
      id: 's1',
      unit_label: 'Woning 1',
      unit_type: 'woning',
      strategy: 'transformeren_verkopen',
      sale_price_total: 500_000,
      transformation_costs: 150_000,
      sale_costs_pct: 1.5,
    } as unknown as SellOffUnit],
    objectType: 'mixed_use' as const,
    correctedAnnualRent: 0,
    saleHasInput: true,
    ovbMissingBasisCount: 0,
    ...overrides,
  };
}

describe('strategie-afhankelijke betrouwbaarheid', () => {
  it('beoordeelt een compleet verkoop-/ontwikkelscenario zonder huur- of WWS-eis als hoog', () => {
    const result = assessInputReliability(input());
    expect(result.level).toBe('hoog');
    expect(result.pillars.find((pillar) => pillar.key === 'wws')?.status).toBe('niet_relevant');
    expect(result.pillars.find((pillar) => pillar.key === 'opbrengst')?.status).toBe('voldoende');
  });

  it('zet het scenario op middel wanneer een positieve algemene kostenpost nog niet hoog is onderbouwd', () => {
    const result = assessInputReliability(input({
      costs: [{ id: 'k1', amount: 100_000, cost_category: 'Architect', reliability_status: 'middel' } as ScenarioCost],
    }));
    expect(result.level).toBe('middel');
    const costs = result.pillars.find((pillar) => pillar.key === 'kosten');
    expect(costs?.status).toBe('aandacht');
    expect(costs?.targetId).toBe('cost-k1');
  });

  it('zet mixed-use op laag wanneer OVB niet per component is ingericht', () => {
    const result = assessInputReliability(input({
      scenario: {
        strategy_type: 'buy_transform_sell',
        sale_strategy: 'transformeren_verkopen',
        sale_target_margin_percentage: 15,
        ovb_mode: 'auto',
        assumptions_source: 'Bron',
        assumptions_reliability: 'hoog',
      } as unknown as Scenario,
    }));
    expect(result.level).toBe('laag');
    expect(result.pillars.find((pillar) => pillar.key === 'fiscaliteit')?.status).toBe('ontbreekt');
  });

  it('vereist bij een exploitatie-/verhuurscenario wel huur, BAR en volledige WWS-invoer', () => {
    const result = assessInputReliability(input({
      scenario: {
        strategy_type: 'belegging',
        sale_strategy: 'geen_verkoop',
        target_bar: 6,
        ovb_mode: 'auto',
        rent_source: 'wws_gecorrigeerd',
        assumptions_source: 'Huurcontracten en exploitatiebegroting',
        assumptions_reliability: 'hoog',
      } as unknown as Scenario,
      objectType: 'enkelvoudig',
      strategyUnits: [],
      saleHasInput: false,
      correctedAnnualRent: 120_000,
      costs: [],
      wwsUnits: [],
    }));
    expect(result.level).toBe('laag');
    expect(result.pillars.find((pillar) => pillar.key === 'wws')?.status).toBe('ontbreekt');
    expect(result.pillars.find((pillar) => pillar.key === 'kosten')?.status).toBe('niet_relevant');
  });
});
