import { describe, expect, it } from 'vitest';
import type { ScenarioCost } from '@/lib/vastgoedrekenen/types';
import {
  clearScenarioCostCashflowTimingPatch,
  resolveScenarioCostCashflowTiming,
  scenarioCostCashflowTimingPatch,
} from '@/lib/vastgoedrekenen/scenarioCostCashflowTiming';

function cost(patch: Record<string, unknown> = {}): ScenarioCost {
  return {
    id: 'cost-1',
    scenario_id: 'scenario-1',
    cost_category: 'Advieskosten',
    description: 'Architect',
    amount: 50_000,
    vat_applicable: null,
    reliability_status: 'hoog',
    notes: null,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    ...patch,
  } as unknown as ScenarioCost;
}

describe('scenario cost cashflow timing', () => {
  it('behoudt een volledig legacyrecord als ongetimed in plaats van null als maand 0 te lezen', () => {
    const resolved = resolveScenarioCostCashflowTiming(cost({
      cashflow_timing_method: null,
      cashflow_start_month: null,
      cashflow_end_month: null,
      cashflow_payment_month: null,
      cashflow_timing_schema_version: null,
    }));

    expect(resolved).toMatchObject({
      method: null,
      startMonth: null,
      endMonth: null,
      paymentMonth: null,
      schemaVersion: null,
      explicit: false,
      valid: false,
    });
    expect(resolved.warnings.join(' ')).toMatch(/nog niet vastgelegd/i);
  });

  it('bouwt een atomair eenmalig timingpatch', () => {
    expect(scenarioCostCashflowTimingPatch({ method: 'single', paymentMonth: '3' })).toEqual({
      cashflow_timing_method: 'single',
      cashflow_start_month: null,
      cashflow_end_month: null,
      cashflow_payment_month: 3,
      cashflow_timing_schema_version: 1,
    });
  });

  it('bouwt een lineair timingpatch en weigert omgekeerde chronologie', () => {
    expect(scenarioCostCashflowTimingPatch({
      method: 'linear',
      startMonth: '2',
      endMonth: '8',
    })).toEqual({
      cashflow_timing_method: 'linear',
      cashflow_start_month: 2,
      cashflow_end_month: 8,
      cashflow_payment_month: null,
      cashflow_timing_schema_version: 1,
    });

    expect(() => scenarioCostCashflowTimingPatch({
      method: 'linear',
      startMonth: 8,
      endMonth: 2,
    })).toThrow(/niet vóór de startmaand/i);
  });

  it('markeert timing buiten de Quickscan-horizon als ongeldig', () => {
    const resolved = resolveScenarioCostCashflowTiming(cost({
      cashflow_timing_method: 'single',
      cashflow_payment_month: 30,
      cashflow_timing_schema_version: 1,
    }), 24);

    expect(resolved.valid).toBe(false);
    expect(resolved.warnings.join(' ')).toMatch(/buiten de Quickscan-horizon/i);
  });

  it('levert een expliciete clearpatch zonder impliciete default', () => {
    expect(clearScenarioCostCashflowTimingPatch()).toEqual({
      cashflow_timing_method: null,
      cashflow_start_month: null,
      cashflow_end_month: null,
      cashflow_payment_month: null,
      cashflow_timing_schema_version: null,
    });
  });
});
