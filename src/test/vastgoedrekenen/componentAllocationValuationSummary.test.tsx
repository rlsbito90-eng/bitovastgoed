import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import ComponentAllocationValuationSummary from '@/components/vastgoedrekenen/ComponentAllocationValuationSummary';

function unit(id: string, allocation: number): SellOffUnit {
  return {
    id,
    scenario_id: 'scenario-1',
    component_id: 'component-1',
    unit_name: id,
    unit_label: id,
    unit_type: 'woning',
    strategy: 'verkopen_leeg',
    surface_gbo: 100,
    sale_price_source: 'totaal',
    sale_price_total: 1_000_000,
    sale_costs_pct: 10,
    legal_costs: 10_000,
    allocation_percentage: allocation,
    allocation_timing_schema_version: 1,
    sort_order: 0,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
  } as unknown as SellOffUnit;
}

describe('ComponentAllocationValuationSummary', () => {
  it('toont per 50%-deel de effectieve bijdrage, oppervlakte en één totale componentwaarde', () => {
    render(<ComponentAllocationValuationSummary units={[unit('Deel A', 50), unit('Deel B', 50)]} />);

    expect(screen.getByRole('region', { name: /allocatiegewogen waardering/i })).toBeInTheDocument();
    expect(screen.getAllByText(/% allocatie/)).toHaveLength(2);
    expect(screen.getAllByText('Gewogen')).toHaveLength(2);
    expect(screen.getAllByText(/445\.000/)).toHaveLength(2);
    expect(screen.getByText(/890\.000/)).toBeInTheDocument();
    expect(screen.getByText('Effectief oppervlak')).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.textContent?.includes('effectief 50') === true))
      .toHaveLength(2);
    expect(screen.getAllByText(/8\.900.*\/m²/)).toHaveLength(3);
  });

  it('markeert een enkele 50%-regel als ongewogen onderverdeeld', () => {
    render(<ComponentAllocationValuationSummary units={[unit('Deel A', 50)]} />);

    expect(screen.getByText('Ongewogen · onderverdeeld')).toBeInTheDocument();
    expect(screen.getAllByText(/890\.000/)).toHaveLength(2);
    expect(screen.getAllByText((_, element) => element?.textContent?.includes('effectief 100') === true))
      .toHaveLength(1);
  });
});
