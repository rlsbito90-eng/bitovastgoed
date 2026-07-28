import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ComponentPeriodicCashflowPreview from '@/components/vastgoedrekenen/ComponentPeriodicCashflowPreview';
import type { ComponentPeriodicCashflowResult } from '@/lib/vastgoedrekenen/componentPeriodicCashflow';

function result(patch: Partial<ComponentPeriodicCashflowResult>): ComponentPeriodicCashflowResult {
  return {
    readyForPeriodicCashflow: true,
    readyForDiscounting: true,
    horizonMonths: 24,
    monthly: [],
    periods: [
      {
        periodIndex: 1,
        label: 'Jaar 1 · maand 1–12',
        fromMonth: 1,
        toMonth: 12,
        rentalIncome: 12_000,
        grossSaleProceeds: 500_000,
        terminalValue: 0,
        developmentCosts: 100_000,
        dispositionCosts: 50_000,
        netCashflow: 362_000,
      },
    ],
    totals: {
      rentalIncome: 12_000,
      grossSaleProceeds: 500_000,
      terminalValue: 0,
      developmentCosts: 100_000,
      dispositionCosts: 50_000,
      netCashflow: 362_000,
    },
    blockers: [],
    discountingBlockers: [],
    warnings: [],
    ...patch,
  };
}

describe('ComponentPeriodicCashflowPreview', () => {
  it('toont de periodieke componentstroom en maakt de uitgesloten kostencategorieën expliciet', () => {
    render(<ComponentPeriodicCashflowPreview result={result({})} />);

    expect(screen.getByRole('region', { name: /periodieke componentkasstroom/i })).toBeInTheDocument();
    expect(screen.getByText('Kasstroom gereed')).toBeInTheDocument();
    expect(screen.getByText(/Aankoop, OVB, algemene projectkosten en financiering zijn nog niet opgenomen/i)).toBeInTheDocument();
    expect(screen.getByText('Jaar 1 · maand 1–12')).toBeInTheDocument();
    expect(screen.getAllByText(/362\.000/).length).toBeGreaterThan(0);
  });

  it('toont blockers zonder een gedeeltelijke kasstroomtabel te presenteren', () => {
    render(<ComponentPeriodicCashflowPreview result={result({
      readyForPeriodicCashflow: false,
      readyForDiscounting: false,
      periods: [],
      blockers: ['Component A: allocatiegroep moet exact 100% zijn.'],
    })} />);

    expect(screen.getByText('Geblokkeerd')).toBeInTheDocument();
    expect(screen.getByText(/allocatiegroep moet exact 100%/i)).toBeInTheDocument();
    expect(screen.queryByText('Jaar 1 · maand 1–12')).not.toBeInTheDocument();
  });
});
