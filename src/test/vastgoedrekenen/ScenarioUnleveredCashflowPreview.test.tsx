import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScenarioUnleveredCashflowPreview from '@/components/vastgoedrekenen/ScenarioUnleveredCashflowPreview';
import type { ScenarioUnleveredCashflowResult } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';

function result(patch: Partial<ScenarioUnleveredCashflowResult> = {}): ScenarioUnleveredCashflowResult {
  return {
    readyForPeriodicCashflow: true,
    readyForDiscounting: true,
    horizonMonths: 24,
    monthly: [],
    periods: [
      {
        periodIndex: 0,
        label: 'Maand 0',
        fromMonth: 0,
        toMonth: 0,
        purchasePrice: 1_000_000,
        transferTax: 80_000,
        acquisitionCosts: 20_000,
        rentalIncome: 0,
        grossSaleProceeds: 0,
        terminalValue: 0,
        componentDevelopmentCosts: 10_000,
        sharedScenarioCosts: 0,
        dispositionCosts: 0,
        netCashflow: -1_110_000,
      },
      {
        periodIndex: 2,
        label: 'Jaar 2 · maand 13–24',
        fromMonth: 13,
        toMonth: 24,
        purchasePrice: 0,
        transferTax: 0,
        acquisitionCosts: 0,
        rentalIncome: 0,
        grossSaleProceeds: 1_500_000,
        terminalValue: 0,
        componentDevelopmentCosts: 0,
        sharedScenarioCosts: 0,
        dispositionCosts: 160_000,
        netCashflow: 1_340_000,
      },
    ],
    totals: {
      purchasePrice: 1_000_000,
      transferTax: 80_000,
      acquisitionCosts: 20_000,
      rentalIncome: 0,
      grossSaleProceeds: 1_500_000,
      terminalValue: 0,
      componentDevelopmentCosts: 120_000,
      sharedScenarioCosts: 60_000,
      dispositionCosts: 160_000,
      netCashflow: 60_000,
    },
    reconciliation: {
      expectedUnleveredInvestment: 1_280_000,
      reportedUnleveredInvestment: 1_280_000,
      difference: 0,
      reconciled: true,
    },
    blockers: [],
    discountingBlockers: [],
    warnings: [],
    ...patch,
  };
}

describe('ScenarioUnleveredCashflowPreview', () => {
  it('toont de volledige ongefinancierde projecttijdlijn en aansluiting op de investering', () => {
    render(<ScenarioUnleveredCashflowPreview result={result()} />);

    expect(screen.getByRole('region', { name: /ongefinancierde scenariokasstroom/i })).toBeInTheDocument();
    expect(screen.getByText('Projecttijdlijn gereed')).toBeInTheDocument();
    expect(screen.getByText('Compleet voor DCF-fase')).toBeInTheDocument();
    expect(screen.getByText(/Financieringsopnames, rente en aflossing zijn bewust uitgesloten/i)).toBeInTheDocument();
    expect(screen.getByText(/Aansluiting investering: sluit aan/i)).toBeInTheDocument();
    expect(screen.getByText('Jaar 2 · maand 13–24')).toBeInTheDocument();
    expect(screen.getAllByText(/60\.000/).length).toBeGreaterThan(0);
  });

  it('toont blockers zonder een onvolledige projecttabel', () => {
    render(<ScenarioUnleveredCashflowPreview result={result({
      readyForPeriodicCashflow: false,
      readyForDiscounting: false,
      periods: [],
      blockers: ['Architect: kasstroomtiming is nog niet vastgelegd.'],
      reconciliation: null,
    })} />);

    expect(screen.getByText('Geblokkeerd')).toBeInTheDocument();
    expect(screen.getByText(/kasstroomtiming is nog niet vastgelegd/i)).toBeInTheDocument();
    expect(screen.queryByText('Jaar 2 · maand 13–24')).not.toBeInTheDocument();
  });
});
