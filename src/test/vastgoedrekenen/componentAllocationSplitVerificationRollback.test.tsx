import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import ComponentAllocationTimingWorkspace from '@/components/vastgoedrekenen/ComponentAllocationTimingWorkspace';

function unit(): SellOffUnit {
  return {
    id: 'unit-verify-fail',
    scenario_id: 'scenario-1',
    component_id: 'component-1',
    unit_name: 'Woningen',
    unit_label: 'Woningen',
    unit_type: 'woning',
    strategy: 'verkopen_leeg',
    allocation_percentage: null,
    allocation_timing_schema_version: null,
    sale_price_source: 'totaal',
    sale_price_total: 1_000_000,
    sort_order: 0,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
  } as unknown as SellOffUnit;
}

describe('componentallocatie split read-back', () => {
  it('herstelt de oorspronkelijke allocatie als de eerste update niet kan worden bevestigd', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onCreate = vi.fn().mockResolvedValue({ id: 'clone-mag-niet-worden-aangemaakt' });

    render(
      <ComponentAllocationTimingWorkspace
        units={[unit()]}
        onCreate={onCreate}
        onUpdate={onUpdate}
        timeHorizonMonthsOverride={60}
        verifySplitUpdate={async () => false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /splits allocatie/i }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: /splits allocatie/i }),
    );

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
    expect(onUpdate.mock.calls[0]).toEqual([
      'unit-verify-fail',
      { allocation_percentage: 50, allocation_timing_schema_version: 1 },
    ]);
    expect(onUpdate.mock.calls[1]).toEqual([
      'unit-verify-fail',
      { allocation_percentage: null, allocation_timing_schema_version: null },
    ]);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
