import { describe, expect, it } from 'vitest';
import { computeScenarioOvb } from '@/lib/vastgoedrekenen/ovb';
import type { Component, Scenario } from '@/lib/vastgoedrekenen/types';

function scenario(patch: Partial<Scenario> = {}): Scenario {
  return {
    purchase_price: 1_000_000,
    ovb_mode: 'per_component',
    ovb_classification: 'mixed_use',
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    ...patch,
  } as Scenario;
}

function component(id: string, patch: Partial<Component> = {}): Component {
  return {
    id,
    component_type: 'appartement',
    allocated_component_value: null,
    transfer_tax_allocation_method: 'value',
    transfer_tax_classification: 'woning_belegging',
    transfer_tax_percentage: null,
    transfer_tax_amount: null,
    transfer_tax_manual_override: false,
    surface_gbo: 0,
    ...patch,
  } as Component;
}

describe('OVB op actuele verkrijgingssituatie', () => {
  it('gebruikt huidige componentwaarden als verdeelsleutel voor de aankoopprijs', () => {
    const result = computeScenarioOvb(scenario(), [
      component('a', { allocated_component_value: 600_000 }),
      component('b', { allocated_component_value: 400_000, component_type: 'kantoorruimte', transfer_tax_classification: 'niet_woning' }),
    ], null, 'mixed_use');

    expect(result.perComponent.map((row) => row.basisValue)).toEqual([600_000, 400_000]);
    expect(result.perComponent.reduce((sum, row) => sum + row.basisValue, 0)).toBe(1_000_000);
  });

  it('markeert ontbrekende aankoopprijs en toont daarom geen schijn-OVB', () => {
    const result = computeScenarioOvb(scenario({ purchase_price: null }), [
      component('a', { allocated_component_value: 600_000 }),
      component('b', { allocated_component_value: 400_000 }),
    ], null, 'mixed_use');

    expect(result.totalOvb).toBe(0);
    expect(result.missingBasisCount).toBe(2);
    expect(result.perComponent.every((row) => row.missingPurchaseBasis)).toBe(true);
  });

  it('markeert toekomstige strategiewaarde als indicatieve verdeelsleutel zonder ontbrekende grondslag', () => {
    const result = computeScenarioOvb(scenario(), [
      component('a', { transfer_tax_allocation_method: 'strategy' }),
      component('b', { transfer_tax_allocation_method: 'strategy' }),
    ], null, 'mixed_use', new Map([['a', 700_000], ['b', 300_000]]));

    expect(result.perComponent.every((row) => row.usesFutureStrategyAllocation)).toBe(true);
    expect(result.missingBasisCount).toBe(0);
    expect(result.perComponent.reduce((sum, row) => sum + row.basisValue, 0)).toBe(1_000_000);
  });

  it('blokkeert een combinatie van verschillende automatische verdeelmethoden', () => {
    const result = computeScenarioOvb(scenario(), [
      component('a', { allocated_component_value: 600_000, transfer_tax_allocation_method: 'value' }),
      component('b', { surface_gbo: 100, transfer_tax_allocation_method: 'm2' }),
    ], null, 'mixed_use');

    expect(result.totalOvb).toBe(0);
    expect(result.perComponent.every((row) => row.mixedAllocationMethods)).toBe(true);
  });
});
