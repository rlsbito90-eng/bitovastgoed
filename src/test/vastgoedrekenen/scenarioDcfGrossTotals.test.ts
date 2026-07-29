import { describe, expect, it } from 'vitest';
import { buildScenarioDcf } from '@/lib/vastgoedrekenen/scenarioDcf';
import type { ScenarioUnleveredCashflowResult } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';

describe('DCF bruto instroom en uitstroom', () => {
  it('saldeert verkoopopbrengst en verkoopkosten niet weg in de kasstroommultiple', () => {
    const cashflow: ScenarioUnleveredCashflowResult = {
      readyForPeriodicCashflow: true,
      readyForDiscounting: true,
      horizonMonths: 12,
      monthly: [
        {
          month: 0,
          purchasePrice: 500,
          transferTax: 0,
          acquisitionCosts: 0,
          rentalIncome: 0,
          grossSaleProceeds: 0,
          terminalValue: 0,
          componentDevelopmentCosts: 0,
          sharedScenarioCosts: 0,
          dispositionCosts: 0,
          netCashflow: -500,
          cumulativeCashflow: -500,
        },
        {
          month: 12,
          purchasePrice: 0,
          transferTax: 0,
          acquisitionCosts: 0,
          rentalIncome: 0,
          grossSaleProceeds: 1_000,
          terminalValue: 0,
          componentDevelopmentCosts: 0,
          sharedScenarioCosts: 0,
          dispositionCosts: 100,
          netCashflow: 900,
          cumulativeCashflow: 400,
        },
      ],
      periods: [],
      totals: {
        purchasePrice: 500,
        transferTax: 0,
        acquisitionCosts: 0,
        rentalIncome: 0,
        grossSaleProceeds: 1_000,
        terminalValue: 0,
        componentDevelopmentCosts: 0,
        sharedScenarioCosts: 0,
        dispositionCosts: 100,
        netCashflow: 400,
      },
      reconciliation: null,
      blockers: [],
      discountingBlockers: [],
      warnings: [],
    };

    const result = buildScenarioDcf(cashflow, {
      annualDiscountRatePct: 8,
      source: 'Testbron',
      notes: null,
      schemaVersion: 1,
      explicit: true,
      valid: true,
      warnings: [],
    });

    expect(result.totalInflows).toBe(1_000);
    expect(result.totalOutflows).toBe(600);
    expect(result.investmentMultiple).toBeCloseTo(1_000 / 600, 8);
  });
});
