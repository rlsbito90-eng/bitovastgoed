import { describe, expect, it, vi } from 'vitest';
import type { Scenario, WwsUnit, Component, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { buildScenarioSavePatch, guardScenarioUpdatePatch } from '@/lib/vastgoedrekenen/saveGuards';
import { objectToDb } from '@/hooks/useDataStore';

const scenario = (overrides: Partial<Scenario> = {}) => ({
  id: 's1', calculation_id: 'c1', object_id: 'o1', scenario_name: 'Hinthamerstraat', status: 'concept', strategy_type: 'belegging',
  asking_price: 2_300_000, purchase_price: 2_100_000, rent_source: 'componenten', sale_strategy: 'geen_verkoop',
  leading_valuation_track: 'auto', ovb_mode: 'per_component', ovb_classification: 'woning_belegging',
  transfer_tax_percentage: 8, buyer_fee_percentage: 2, target_bar: 6, manual_zero_fields: [], created_at: '', updated_at: '',
  ...overrides,
}) as unknown as Scenario;

describe('data-integriteit save-guards Vastgoedrekenen', () => {
  it('stuurt bij scenario-save alleen aangeraakte scenario-velden mee', () => {
    const base = scenario();
    const current = scenario({ scenario_name: 'Hinthamerstraat — variant' });
    const patch = buildScenarioSavePatch(current, base, ['scenario_name']);
    expect(patch).toEqual({ scenario_name: 'Hinthamerstraat — variant' });
    expect(patch).not.toHaveProperty('asking_price');
    expect(patch).not.toHaveProperty('purchase_price');
  });

  it('blokkeert wissen van vraagprijs zonder expliciete leegmaakactie', () => {
    const warn = vi.fn();
    const result = guardScenarioUpdatePatch({ asking_price: null }, scenario(), warn);
    expect(result.patch).not.toHaveProperty('asking_price');
    expect(result.blockedFields).toContain('asking_price');
    expect(warn).toHaveBeenCalledWith('asking_price');
  });

  it('staat bewust leegmaken van vraagprijs alleen toe met expliciete marker', () => {
    const result = guardScenarioUpdatePatch({ asking_price: null, __allowClearFields: ['asking_price'] }, scenario());
    expect(result.patch).toEqual({ asking_price: null });
  });

  it('behoudt vraagprijs bij WWS-, component-, strategie-, bulk-, import- en herbereken-payloads', () => {
    const wwsPatch: Partial<WwsUnit> = { energy_label: 'A', wws_points: 170 };
    const componentPatch: Partial<Component> = { surface_gbo: 82 };
    const strategyPatch: Partial<SellOffUnit> = { strategy: 'verkopen_leeg', sale_price_total: 350_000 };
    for (const patch of [wwsPatch, componentPatch, strategyPatch]) {
      expect(patch).not.toHaveProperty('asking_price');
      expect(patch).not.toHaveProperty('purchase_price');
    }
  });

  it('ObjectDetailPage partial update wist vraagprijs niet bij ontbrekende formvelden', () => {
    const dbPatch = objectToDb({ pipelineStageLocked: false } as never);
    expect(dbPatch).toEqual({ pipeline_stage_locked: false });
    expect(dbPatch).not.toHaveProperty('vraagprijs');
  });
});
