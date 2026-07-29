import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ScenarioDcfAnalysis from '@/components/vastgoedrekenen/ScenarioDcfAnalysis';
import type { ScenarioUnleveredCashflowResult } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';
import type { Scenario } from '@/lib/vastgoedrekenen/types';

function scenario(patch: Record<string, unknown> = {}): Scenario {
  return {
    id: 'scenario-1',
    dcf_discount_rate_pct: 10,
    dcf_discount_rate_source: 'Interne rendementseis',
    dcf_discount_rate_notes: null,
    dcf_schema_version: 1,
    ...patch,
  } as unknown as Scenario;
}

function cashflow(patch: Partial<ScenarioUnleveredCashflowResult> = {}): ScenarioUnleveredCashflowResult {
  return {
    readyForPeriodicCashflow: true,
    readyForDiscounting: true,
    horizonMonths: 12,
    monthly: [
      {
        month: 0,
        purchasePrice: 1_000,
        transferTax: 0,
        acquisitionCosts: 0,
        rentalIncome: 0,
        grossSaleProceeds: 0,
        terminalValue: 0,
        componentDevelopmentCosts: 0,
        sharedScenarioCosts: 0,
        dispositionCosts: 0,
        netCashflow: -1_000,
        cumulativeCashflow: -1_000,
      },
      {
        month: 12,
        purchasePrice: 0,
        transferTax: 0,
        acquisitionCosts: 0,
        rentalIncome: 0,
        grossSaleProceeds: 1_210,
        terminalValue: 0,
        componentDevelopmentCosts: 0,
        sharedScenarioCosts: 0,
        dispositionCosts: 0,
        netCashflow: 1_210,
        cumulativeCashflow: 210,
      },
    ],
    periods: [],
    totals: {
      purchasePrice: 1_000,
      transferTax: 0,
      acquisitionCosts: 0,
      rentalIncome: 0,
      grossSaleProceeds: 1_210,
      terminalValue: 0,
      componentDevelopmentCosts: 0,
      sharedScenarioCosts: 0,
      dispositionCosts: 0,
      netCashflow: 210,
    },
    reconciliation: null,
    blockers: [],
    discountingBlockers: [],
    warnings: [],
    ...patch,
  };
}

describe('ScenarioDcfAnalysis', () => {
  it('toont NCW, unlevered IRR en de expliciet opgeslagen bron', () => {
    render(
      <ScenarioDcfAnalysis
        scenario={scenario()}
        cashflow={cashflow()}
        onSaved={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('region', { name: /ongefinancierde DCF-analyse/i })).toBeInTheDocument();
    expect(screen.getByText('DCF gereed')).toBeInTheDocument();
    expect(screen.getByText(/10,00% per jaar · Interne rendementseis/i)).toBeInTheDocument();
    expect(screen.getByText('NCW positief')).toBeInTheDocument();
    expect(screen.getByText('Unlevered IRR')).toBeInTheDocument();
    expect(screen.getByText(/21,00%/)).toBeInTheDocument();
    expect(screen.getByText('Jaar 1 · maand 1–12')).toBeInTheDocument();
  });

  it('toont blockers zonder een gedeeltelijke DCF-tabel', () => {
    render(
      <ScenarioDcfAnalysis
        scenario={scenario({
          dcf_discount_rate_pct: null,
          dcf_discount_rate_source: null,
          dcf_discount_rate_notes: null,
          dcf_schema_version: null,
        })}
        cashflow={cashflow()}
        onSaved={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Geblokkeerd')).toBeInTheDocument();
    expect(screen.getByText(/Leg eerst een jaarlijkse ongefinancierde disconteringsvoet/i)).toBeInTheDocument();
    expect(screen.queryByText('Jaar 1 · maand 1–12')).not.toBeInTheDocument();
  });
});
