import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { aggregateStrategy } from '@/lib/vastgoedrekenen/componentStrategy';
import ComponentAllocationTimingWorkspace from '@/components/vastgoedrekenen/ComponentAllocationTimingWorkspace';

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
    sale_costs_pct: 2,
    legal_costs: 5_000,
    sort_order: 0,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    ...overrides,
  } as unknown as SellOffUnit;
}

function renderWorkspace(units: SellOffUnit[], options: {
  onCreate?: ReturnType<typeof vi.fn>;
  onUpdate?: ReturnType<typeof vi.fn>;
  horizon?: number | null;
  verifySplitUpdate?: () => Promise<boolean>;
} = {}) {
  const onCreate = options.onCreate ?? vi.fn().mockResolvedValue({ id: 'clone-1' });
  const onUpdate = options.onUpdate ?? vi.fn().mockResolvedValue(undefined);
  const view = render(
    <ComponentAllocationTimingWorkspace
      units={units}
      onCreate={onCreate}
      onUpdate={onUpdate}
      timeHorizonMonthsOverride={options.horizon ?? null}
      verifySplitUpdate={options.verifySplitUpdate ?? (async () => true)}
    />,
  );
  return { ...view, onCreate, onUpdate };
}

describe('ComponentAllocationTimingWorkspace', () => {
  it('toont een legacy-null allocatie als 100% zonder automatisch te schrijven en waarschuwt buiten de horizon', () => {
    const { onUpdate } = renderWorkspace([
      unit({ allocation_percentage: null, expected_sale_period_months: 18 }),
    ], { horizon: 12 });

    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/verkoop in maand 18 valt buiten de Quickscan-horizon van 12 maanden/i).length).toBeGreaterThan(0);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('toont strategie-afhankelijke timingvelden', () => {
    const { rerender } = renderWorkspace([unit()], { horizon: 60 });
    fireEvent.click(screen.getByRole('button', { name: /timing bewerken/i }));
    expect(screen.getByText('Allocatie van component (%)')).toBeInTheDocument();
    expect(screen.getByText('Ontvangst verkoopopbrengst (maand)')).toBeInTheDocument();
    expect(screen.queryByText('Start huurkasstroom (maand)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /annuleren/i }));

    rerender(
      <ComponentAllocationTimingWorkspace
        units={[unit({ strategy: 'renoveren_aanhouden' })]}
        onCreate={vi.fn().mockResolvedValue({ id: 'clone' })}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
        timeHorizonMonthsOverride={60}
        verifySplitUpdate={async () => true}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /timing bewerken/i }));
    expect(screen.getByText('Ontwikkelstart (maand)')).toBeInTheDocument();
    expect(screen.getByText('Oplevering/einde ontwikkeling (maand)')).toBeInTheDocument();
    expect(screen.getByText('Start huurkasstroom (maand)')).toBeInTheDocument();
    expect(screen.getByText('Optionele terminale exit (maand)')).toBeInTheDocument();
    expect(screen.queryByText('Ontvangst verkoopopbrengst (maand)')).not.toBeInTheDocument();
  });

  it('blokkeert een ongeldige ontwikkelvolgorde vóór onUpdate', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderWorkspace([unit({ strategy: 'transformeren_verkopen' })], { onUpdate, horizon: 60 });
    fireEvent.click(screen.getByRole('button', { name: /timing bewerken/i }));

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(4);
    fireEvent.change(inputs[1], { target: { value: '10' } });
    fireEvent.change(inputs[2], { target: { value: '5' } });
    fireEvent.change(inputs[3], { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /allocatie & timing opslaan/i }));

    await vi.waitFor(() => expect(onUpdate).not.toHaveBeenCalled());
  });

  it('splitst pas na bevestiging en maakt daarna het tweede deel aan', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onCreate = vi.fn().mockResolvedValue({ id: 'clone-1' });
    renderWorkspace([unit({ allocation_percentage: null })], { onUpdate, onCreate });

    fireEvent.click(screen.getByRole('button', { name: /splits allocatie/i }));
    expect(onUpdate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/50% en 50%/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /splits allocatie/i }));

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith('unit-1', {
      allocation_percentage: 50,
      allocation_timing_schema_version: 1,
    }));
    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      component_id: 'component-1',
      strategy: 'verkopen_leeg',
      allocation_percentage: 50,
      allocation_timing_schema_version: 1,
      unit_label: 'Woningen — deel 2',
    });
  });

  it('herstelt de oorspronkelijke allocatie wanneer het tweede deel niet kan worden aangemaakt', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onCreate = vi.fn().mockResolvedValue(null);
    renderWorkspace([unit({ allocation_percentage: null, allocation_timing_schema_version: null })], { onUpdate, onCreate });

    fireEvent.click(screen.getByRole('button', { name: /splits allocatie/i }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /splits allocatie/i }));

    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
    expect(onUpdate.mock.calls[1]).toEqual(['unit-1', {
      allocation_percentage: null,
      allocation_timing_schema_version: null,
    }]);
  });

  it('toont complete, onderverdeelde en oververdeelde allocatiegroepen', () => {
    renderWorkspace([
      unit({ id: 'a', component_id: 'complete', unit_label: 'Compleet', allocation_percentage: 100 }),
      unit({ id: 'b1', component_id: 'under', unit_label: 'Onder A', allocation_percentage: 40 }),
      unit({ id: 'b2', component_id: 'under', unit_label: 'Onder B', allocation_percentage: 40 }),
      unit({ id: 'c1', component_id: 'over', unit_label: 'Over A', allocation_percentage: 60 }),
      unit({ id: 'c2', component_id: 'over', unit_label: 'Over B', allocation_percentage: 60 }),
    ]);

    expect(screen.getAllByText('Compleet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Onderverdeeld').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Oververdeeld').length).toBeGreaterThan(0);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();
  });

  it('laat timingbedragen gelijk en waarschuwt wanneer slechts 50% is toegewezen', () => {
    const before = unit({ id: 'same-value' });
    const after = unit({
      id: 'same-value',
      allocation_percentage: 50,
      development_start_month: 0,
      development_end_month: 12,
      expected_sale_period_months: 18,
      allocation_timing_schema_version: 1,
    });
    const beforeTotals = aggregateStrategy([before]);
    const afterTotals = aggregateStrategy([after]);

    expect(afterTotals.scenarioValue).toBe(beforeTotals.scenarioValue);
    expect(afterTotals.grossDevelopmentValue).toBe(beforeTotals.grossDevelopmentValue);
    expect(afterTotals.componentDispositionCosts).toBe(beforeTotals.componentDispositionCosts);
    expect(afterTotals.componentDevelopmentCosts).toBe(beforeTotals.componentDevelopmentCosts);
    expect(afterTotals.extraInvestmentCosts).toBe(beforeTotals.extraInvestmentCosts);
    expect(afterTotals.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('onderverdeeld (50%)'),
      expect.stringContaining('ongewogen rekenwijze'),
    ]));
  });
});
