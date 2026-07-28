import { describe, expect, it } from 'vitest';
import { isSplitOnlyPatch } from '@/components/vastgoedrekenen/ComponentStrategyTable';

describe('componentallocatie split guard', () => {
  it('blokkeert uitsluitend de tweevoudige splitpatch', () => {
    expect(isSplitOnlyPatch({
      allocation_percentage: 50,
      allocation_timing_schema_version: 1,
    })).toBe(true);

    expect(isSplitOnlyPatch({
      allocation_percentage: 50,
      development_start_month: 0,
      development_end_month: 12,
      rent_start_month: null,
      expected_sale_period_months: 18,
      hold_exit_month: null,
      allocation_timing_schema_version: 1,
    })).toBe(false);

    expect(isSplitOnlyPatch({ allocation_percentage: 50 })).toBe(false);
  });
});
