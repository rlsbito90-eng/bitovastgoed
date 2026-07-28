import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnalysisScopeSettings from '@/components/vastgoedrekenen/AnalysisScopeSettings';
import ScenarioTaxonomyPanel from '@/components/vastgoedrekenen/ScenarioTaxonomyPanel';
import type { PersistedCalculationAnalysis, Scenario } from '@/lib/vastgoedrekenen/types';

describe('Vastgoedrekenen taxonomie Fase 3A — Quickscan-scope', () => {
  it('schrijft uitsluitend analysevraag, peildatum en tijdshorizon', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const analysis = {
      id: 'analysis-1',
      analysis_question: 'Welke strategie levert het meeste op?',
      valuation_date: '2026-07-28',
      time_horizon_months: 60,
    } as PersistedCalculationAnalysis;

    render(<AnalysisScopeSettings analysis={analysis} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Analysevraag'), {
      target: { value: 'Welke strategie levert binnen 3 jaar de meeste vrije kasstroom op?' },
    });
    fireEvent.change(screen.getByLabelText('Tijdshorizon (maanden)'), {
      target: { value: '36' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Scope opslaan' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      analysis_question: 'Welke strategie levert binnen 3 jaar de meeste vrije kasstroom op?',
      valuation_date: '2026-07-28',
      time_horizon_months: 36,
    });
  });

  it('blokkeert een ongeldige tijdshorizon vóór persistence', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const analysis = {
      id: 'analysis-2',
      analysis_question: null,
      valuation_date: null,
      time_horizon_months: null,
    } as PersistedCalculationAnalysis;

    render(<AnalysisScopeSettings analysis={analysis} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Tijdshorizon (maanden)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scope opslaan' }));

    expect(await screen.findByText(/geheel aantal maanden tussen 1 en 1200/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('Vastgoedrekenen taxonomie Fase 3A — scenario-classificatie', () => {
  it('toont een legacy-afleiding maar schrijft pas na expliciete bevestiging', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const scenario = {
      id: 'scenario-1',
      strategy_type: 'buy_transform_sell',
      business_case: null,
      intervention: null,
      expansion_subtype: null,
      exploitation_mode: null,
      disposition: null,
      taxonomy_schema_version: null,
    } as Scenario;

    render(<ScenarioTaxonomyPanel scenario={scenario} onSave={onSave} />);

    expect(screen.getByText('Afgeleid uit bestaande strategie')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Classificatie vastleggen' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      business_case: 'redevelopment',
      intervention: 'transform',
      expansion_subtype: null,
      exploitation_mode: 'vacant',
      disposition: 'sell_as_whole',
      taxonomy_schema_version: 1,
    });
  });

  it('herkent een volledig opgeslagen canonieke classificatie', () => {
    const scenario = {
      id: 'scenario-2',
      strategy_type: 'belegging',
      business_case: 'redevelopment',
      intervention: 'expand',
      expansion_subtype: 'rooftop_addition',
      exploitation_mode: 'rental',
      disposition: 'hold',
      taxonomy_schema_version: 1,
    } as Scenario;

    render(<ScenarioTaxonomyPanel scenario={scenario} onSave={vi.fn().mockResolvedValue(true)} />);

    expect(screen.getByText('Canoniek opgeslagen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Classificatie opslaan' })).toBeDisabled();
    expect(screen.getByText(/bouwvolume bovenop bestaande bouw toevoegen/i)).toBeInTheDocument();
  });
});
