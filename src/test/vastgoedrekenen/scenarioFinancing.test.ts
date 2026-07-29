import { describe, expect, it } from 'vitest';
import {
  buildScenarioFinancing,
  type ScenarioFinancingFacility,
} from '@/lib/vastgoedrekenen/scenarioFinancing';
import type {
  ScenarioUnleveredCashflowMonth,
  ScenarioUnleveredCashflowResult,
} from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';

function month(monthNumber: number, netCashflow: number): ScenarioUnleveredCashflowMonth {
  return {
    month: monthNumber,
    purchasePrice: monthNumber === 0 && netCashflow < 0 ? -netCashflow : 0,
    transferTax: 0,
    acquisitionCosts: 0,
    rentalIncome: netCashflow > 0 ? netCashflow : 0,
    grossSaleProceeds: 0,
    terminalValue: 0,
    componentDevelopmentCosts: monthNumber > 0 && netCashflow < 0 ? -netCashflow : 0,
    sharedScenarioCosts: 0,
    dispositionCosts: 0,
    netCashflow,
    cumulativeCashflow: 0,
  };
}

function cashflow(values: number[], investment = 1_000): ScenarioUnleveredCashflowResult {
  let cumulative = 0;
  const monthly = values.map((value, index) => {
    cumulative += value;
    return { ...month(index, value), cumulativeCashflow: cumulative };
  });
  return {
    readyForPeriodicCashflow: true,
    readyForDiscounting: true,
    horizonMonths: values.length - 1,
    monthly,
    periods: [],
    totals: {
      purchasePrice: investment,
      transferTax: 0,
      acquisitionCosts: 0,
      rentalIncome: values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0),
      grossSaleProceeds: 0,
      terminalValue: 0,
      componentDevelopmentCosts: Math.max(0, -values.slice(1).filter((value) => value < 0).reduce((sum, value) => sum + value, 0)),
      sharedScenarioCosts: 0,
      dispositionCosts: 0,
      netCashflow: values.reduce((sum, value) => sum + value, 0),
    },
    reconciliation: {
      expectedUnleveredInvestment: investment,
      reportedUnleveredInvestment: investment,
      difference: 0,
      reconciled: true,
    },
    blockers: [],
    discountingBlockers: [],
    warnings: [],
  };
}

function facility(patch: Partial<ScenarioFinancingFacility> = {}): ScenarioFinancingFacility {
  return {
    id: 'facility-1',
    scenario_id: 'scenario-1',
    facility_name: 'Aankooplening',
    facility_type: 'acquisition',
    commitment_amount: 600,
    draw_method: 'single_month',
    draw_start_month: 0,
    annual_interest_rate_pct: 0,
    interest_method: 'cash',
    arrangement_fee_pct: null,
    arrangement_fee_amount: null,
    repayment_method: 'bullet',
    amortization_start_month: null,
    maturity_month: 12,
    source: 'Indicatieve term sheet',
    notes: null,
    sort_order: 0,
    schema_version: 1,
    ...patch,
  };
}

describe('scenariofinanciering', () => {
  it('legt de lening als aparte laag bovenop de vastgoedkasstroom', () => {
    const values = [-1_000, ...Array(11).fill(0), 1_300];
    const result = buildScenarioFinancing({ cashflow: cashflow(values), facilities: [facility()] });

    expect(result.ready).toBe(true);
    expect(result.monthly[0]).toMatchObject({ debtDraws: 600, equityCashflow: -400, closingDebtBalance: 600 });
    expect(result.monthly[12]).toMatchObject({ principalRepayment: 600, equityCashflow: 700, closingDebtBalance: 0 });
    expect(result.peakDebt).toBe(600);
    expect(result.peakEquityRequirement).toBe(400);
    expect(result.equityContributions).toBe(400);
    expect(result.equityDistributions).toBe(700);
    expect(result.equityMultiple).toBe(1.75);
    expect(result.loanToCostPct).toBe(60);
    expect(result.leveredIrrAnnualPct).not.toBeNull();
  });

  it('neemt naar behoefte op, begrenst de hoofdsom en schrijft rente bij de schuld', () => {
    const values = [-500, -500, ...Array(10).fill(0), 1_300];
    const result = buildScenarioFinancing({
      cashflow: cashflow(values, 1_000),
      facilities: [facility({
        commitment_amount: 800,
        draw_method: 'project_deficit',
        annual_interest_rate_pct: 12,
        interest_method: 'capitalized',
      })],
    });

    expect(result.ready).toBe(true);
    expect(result.totalDebtDraws).toBe(800);
    expect(result.totalCapitalizedInterest).toBeGreaterThan(0);
    expect(result.totalPrincipalRepayment).toBeGreaterThan(800);
    expect(result.monthly[1].equityCashflow).toBe(-200);
    expect(result.monthly[12].closingDebtBalance).toBeCloseTo(0, 6);
  });

  it('boekt afsluitkosten pas bij de eerste werkelijke opname', () => {
    const values = [-1_000, ...Array(11).fill(0), 1_300];
    const result = buildScenarioFinancing({
      cashflow: cashflow(values),
      facilities: [facility({ arrangement_fee_pct: 1 })],
    });

    expect(result.totalArrangementFees).toBe(6);
    expect(result.monthly[0].equityCashflow).toBe(-406);
    expect(result.monthly.slice(1).every((row) => row.arrangementFees === 0)).toBe(true);
  });

  it('neemt het oude handmatige financieringskostenveld niet over', () => {
    const values = [-1_000, ...Array(11).fill(0), 1_300];
    const result = buildScenarioFinancing({
      cashflow: cashflow(values),
      facilities: [facility()],
      legacyFinancingCosts: 25_000,
    });

    expect(result.ready).toBe(true);
    expect(result.totalCashInterest + result.totalCapitalizedInterest + result.totalArrangementFees).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/oude handmatige veld/i);
  });

  it('blokkeert een eindmaand buiten de Quickscan-horizon', () => {
    const values = [-1_000, ...Array(11).fill(0), 1_300];
    const result = buildScenarioFinancing({
      cashflow: cashflow(values),
      facilities: [facility({ maturity_month: 24 })],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers.join(' ')).toMatch(/buiten de Quickscan-horizon/i);
  });
});
