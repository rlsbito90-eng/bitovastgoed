import { describe, expect, it } from 'vitest';
import type { SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { buildComponentPeriodicCashflow } from '@/lib/vastgoedrekenen/componentPeriodicCashflow';

function unit(
  id: string,
  patch: Record<string, unknown>,
): SellOffUnit {
  return {
    id,
    scenario_id: 'scenario-1',
    component_id: patch.component_id ?? `component-${id}`,
    unit_name: id,
    unit_label: id,
    unit_type: 'woning',
    strategy: 'verkopen_leeg',
    sale_price_source: 'totaal',
    sale_price_total: 1_000_000,
    sale_costs_pct: 10,
    legal_costs: 10_000,
    sort_order: 0,
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    allocation_percentage: 100,
    allocation_timing_schema_version: 1,
    ...patch,
  } as unknown as SellOffUnit;
}

describe('periodieke componentkasstroom', () => {
  it('boekt verkoop en verkoopkosten in de verkoopmaand en spreidt ontwikkelkosten lineair', () => {
    const result = buildComponentPeriodicCashflow([
      unit('Transformatie', {
        strategy: 'transformeren_verkopen',
        transformation_costs: 120_000,
        development_start_month: 0,
        development_end_month: 11,
        expected_sale_period_months: 18,
      }),
    ], 24);

    expect(result.readyForPeriodicCashflow).toBe(true);
    expect(result.readyForDiscounting).toBe(true);
    expect(result.monthly).toHaveLength(25);
    expect(result.monthly.slice(0, 12).every((row) => row.developmentCosts === 10_000)).toBe(true);
    expect(result.monthly[18]).toMatchObject({
      grossSaleProceeds: 1_000_000,
      dispositionCosts: 110_000,
      netCashflow: 890_000,
    });
    expect(result.totals).toEqual({
      rentalIncome: 0,
      grossSaleProceeds: 1_000_000,
      terminalValue: 0,
      developmentCosts: 120_000,
      dispositionCosts: 110_000,
      netCashflow: 770_000,
    });
  });

  it('weegt een complete 60/40 verkoop- en aanhoudmix zonder dubbele kasstroom', () => {
    const result = buildComponentPeriodicCashflow([
      unit('Verkoopdeel', {
        component_id: 'component-mix',
        allocation_percentage: 60,
        strategy: 'verkopen_leeg',
        expected_sale_period_months: 12,
      }),
      unit('Aanhouddeel', {
        component_id: 'component-mix',
        allocation_percentage: 40,
        strategy: 'aanhouden',
        hold_monthly_rent: 10_000,
        hold_valuation_method: 'BAR',
        hold_bar: 6,
        rent_start_month: 1,
        hold_exit_month: 24,
      }),
    ], 24);

    expect(result.readyForPeriodicCashflow).toBe(true);
    expect(result.readyForDiscounting).toBe(true);
    expect(result.totals.grossSaleProceeds).toBe(600_000);
    expect(result.totals.dispositionCosts).toBe(66_000);
    expect(result.totals.rentalIncome).toBe(92_000);
    expect(result.totals.terminalValue).toBe(800_000);
    expect(result.monthly[24].rentalIncome).toBe(0);
    expect(result.monthly[24].terminalValue).toBe(800_000);
    expect(result.totals.netCashflow).toBe(1_426_000);
  });

  it('blokkeert een onderverdeelde allocatiegroep zonder gedeeltelijke geldstroom te tonen', () => {
    const result = buildComponentPeriodicCashflow([
      unit('Half deel', {
        component_id: 'component-incompleet',
        allocation_percentage: 50,
        expected_sale_period_months: 12,
      }),
    ], 24);

    expect(result.readyForPeriodicCashflow).toBe(false);
    expect(result.monthly).toEqual([]);
    expect(result.blockers.join(' ')).toMatch(/exact 100%/i);
  });

  it('blokkeert ontbrekende verplichte timing en een verkoop buiten de horizon', () => {
    const missing = buildComponentPeriodicCashflow([
      unit('Zonder verkoopmaand', { expected_sale_period_months: null }),
    ], 24);
    expect(missing.readyForPeriodicCashflow).toBe(false);
    expect(missing.blockers.join(' ')).toMatch(/verkoopmaand ontbreekt/i);

    const outside = buildComponentPeriodicCashflow([
      unit('Buiten horizon', { expected_sale_period_months: 30 }),
    ], 24);
    expect(outside.readyForPeriodicCashflow).toBe(false);
    expect(outside.blockers.join(' ')).toMatch(/buiten de Quickscan-horizon/i);
  });

  it('kan huur periodiek tonen zonder terminale exit maar markeert discontering als incompleet', () => {
    const result = buildComponentPeriodicCashflow([
      unit('Aanhouden', {
        strategy: 'aanhouden',
        sale_price_total: null,
        hold_monthly_rent: 2_000,
        hold_valuation_method: 'BAR',
        hold_bar: 5,
        rent_start_month: 1,
        hold_exit_month: null,
      }),
    ], 12);

    expect(result.readyForPeriodicCashflow).toBe(true);
    expect(result.readyForDiscounting).toBe(false);
    expect(result.totals.rentalIncome).toBe(24_000);
    expect(result.totals.terminalValue).toBe(0);
    expect(result.discountingBlockers.join(' ')).toMatch(/terminale exitmaand/i);
  });

  it('maakt een schaalbaar jaaroverzicht vanuit de maandregels', () => {
    const result = buildComponentPeriodicCashflow([
      unit('Aanhouden', {
        strategy: 'aanhouden',
        sale_price_total: null,
        hold_monthly_rent: 1_000,
        hold_valuation_method: 'BAR',
        hold_bar: 5,
        rent_start_month: 1,
        hold_exit_month: 24,
      }),
    ], 24);

    expect(result.periods.map((period) => period.label)).toEqual([
      'Jaar 1 · maand 1–12',
      'Jaar 2 · maand 13–24',
    ]);
    expect(result.periods[0].rentalIncome).toBe(12_000);
    expect(result.periods[1].rentalIncome).toBe(11_000);
    expect(result.periods[1].terminalValue).toBe(240_000);
  });
});
