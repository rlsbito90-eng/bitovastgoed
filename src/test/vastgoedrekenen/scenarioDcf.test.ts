import { describe, expect, it } from 'vitest';
import { buildScenarioDcf } from '@/lib/vastgoedrekenen/scenarioDcf';
import type {
  ScenarioUnleveredCashflowMonth,
  ScenarioUnleveredCashflowResult,
} from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';
import type { ResolvedScenarioDcfSettings } from '@/lib/vastgoedrekenen/scenarioDcfSettings';

function month(monthNumber: number, netCashflow: number, terminalValue = 0): ScenarioUnleveredCashflowMonth {
  return {
    month: monthNumber,
    purchasePrice: monthNumber === 0 && netCashflow < 0 ? Math.abs(netCashflow) : 0,
    transferTax: 0,
    acquisitionCosts: 0,
    rentalIncome: 0,
    grossSaleProceeds: netCashflow > 0 && terminalValue === 0 ? netCashflow : 0,
    terminalValue,
    componentDevelopmentCosts: 0,
    sharedScenarioCosts: 0,
    dispositionCosts: 0,
    netCashflow,
    cumulativeCashflow: 0,
  };
}

function cashflow(
  rows: ScenarioUnleveredCashflowMonth[],
  patch: Partial<ScenarioUnleveredCashflowResult> = {},
): ScenarioUnleveredCashflowResult {
  const totals = rows.reduce((sum, row) => ({
    purchasePrice: sum.purchasePrice + row.purchasePrice,
    transferTax: 0,
    acquisitionCosts: 0,
    rentalIncome: 0,
    grossSaleProceeds: sum.grossSaleProceeds + row.grossSaleProceeds,
    terminalValue: sum.terminalValue + row.terminalValue,
    componentDevelopmentCosts: 0,
    sharedScenarioCosts: 0,
    dispositionCosts: 0,
    netCashflow: sum.netCashflow + row.netCashflow,
  }), {
    purchasePrice: 0,
    transferTax: 0,
    acquisitionCosts: 0,
    rentalIncome: 0,
    grossSaleProceeds: 0,
    terminalValue: 0,
    componentDevelopmentCosts: 0,
    sharedScenarioCosts: 0,
    dispositionCosts: 0,
    netCashflow: 0,
  });

  return {
    readyForPeriodicCashflow: true,
    readyForDiscounting: true,
    horizonMonths: rows[rows.length - 1]?.month ?? 0,
    monthly: rows,
    periods: [],
    totals,
    reconciliation: null,
    blockers: [],
    discountingBlockers: [],
    warnings: [],
    ...patch,
  };
}

function settings(rate: number): ResolvedScenarioDcfSettings {
  return {
    annualDiscountRatePct: rate,
    source: 'Testbron',
    notes: null,
    schemaVersion: 1,
    explicit: true,
    valid: true,
    warnings: [],
  };
}

describe('ongefinancierde DCF', () => {
  it('berekent NCW, jaarlijkse effectieve IRR en terugverdientijd uit dezelfde maandstroom', () => {
    const result = buildScenarioDcf(
      cashflow([month(0, -1_000), month(12, 1_210)]),
      settings(10),
    );

    expect(result.readyForDcf).toBe(true);
    expect(result.netPresentValue).toBeCloseTo(100, 6);
    expect(result.unleveredIrrAnnualPct).toBeCloseTo(21, 6);
    expect(result.unleveredIrrMonthlyPct).not.toBeNull();
    expect(result.investmentMultiple).toBeCloseTo(1.21, 8);
    expect(result.peakCapitalRequirement).toBe(1_000);
    expect(result.paybackMonth).toBe(12);
    expect(result.discountedPaybackMonth).toBe(12);
    expect(result.irrStatus).toBe('ok');
  });

  it('past een effectieve jaarvoet tijdsevenredig toe op maandkasstromen', () => {
    const result = buildScenarioDcf(
      cashflow([month(0, -1_000), month(6, 1_100)]),
      settings(21),
    );

    expect(result.netPresentValue).toBeCloseTo(0, 6);
    expect(result.monthly[1].discountFactor).toBeCloseTo(1 / 1.1, 8);
  });

  it('houdt NCW beschikbaar maar weigert een misleidende IRR bij meerdere tekenwisselingen', () => {
    const result = buildScenarioDcf(
      cashflow([month(0, -1_000), month(12, 3_000), month(24, -2_200)]),
      settings(8),
    );

    expect(result.readyForDcf).toBe(true);
    expect(result.netPresentValue).not.toBeNull();
    expect(result.irrStatus).toBe('ambiguous');
    expect(result.unleveredIrrAnnualPct).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/meerdere IRR-oplossingen/i);
  });

  it('blokkeert DCF zolang de bronkasstroom niet compleet is voor discontering', () => {
    const result = buildScenarioDcf(
      cashflow([month(0, -1_000), month(12, 1_200)], {
        readyForDiscounting: false,
        discountingBlockers: ['Aanhouddeel: terminale exitmaand ontbreekt.'],
      }),
      settings(8),
    );

    expect(result.readyForDcf).toBe(false);
    expect(result.monthly).toEqual([]);
    expect(result.blockers.join(' ')).toMatch(/terminale exitmaand ontbreekt/i);
  });

  it('maakt terminale waarde-afhankelijkheid expliciet', () => {
    const rows = [
      month(0, -1_000),
      month(12, 100),
      month(24, 900, 900),
    ];
    const result = buildScenarioDcf(cashflow(rows), settings(8));

    expect(result.terminalValueSharePct).toBeCloseTo(90, 8);
    expect(result.warnings.join(' ')).toMatch(/sterk exit-afhankelijk/i);
  });

  it('behandelt 0% als geldige expliciete voet zonder tijdswaardecorrectie', () => {
    const result = buildScenarioDcf(
      cashflow([month(0, -1_000), month(12, 1_100)]),
      settings(0),
    );

    expect(result.readyForDcf).toBe(true);
    expect(result.netPresentValue).toBe(100);
    expect(result.warnings.join(' ')).toMatch(/gelijk aan het nominale projectresultaat/i);
  });
});
