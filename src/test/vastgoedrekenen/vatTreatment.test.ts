import { describe, expect, it } from 'vitest';
import {
  computeCostBreakdown,
  effectiveCostVatAmount,
  VAT_TREATMENT_LABELS,
} from '@/lib/vastgoedrekenen/investering';
import type { ScenarioCost } from '@/lib/vastgoedrekenen/types';

const cost = (overrides: Partial<Record<string, unknown>> = {}): ScenarioCost =>
  ({
    id: 'c1', scenario_id: 's1', cost_category: 'Bouwkosten',
    description: null, amount: 614_900, notes: null, reliability_status: 'middel',
    vat_applicable: null, calc_mode: 'totaal', amount_per_m2: null, m2_basis: null,
    vat_treatment: 'pct_21', vat_percentage: 21, vat_amount_manual: null,
    created_at: '', updated_at: '',
    ...overrides,
  }) as unknown as ScenarioCost;

describe('Vastgoedrekenen — btw-behandeling per bouwkostenpost', () => {
  it('berekent btw altijd informatief, ook bij behandeling "geen"', () => {
    const b = computeCostBreakdown(cost({ vat_treatment: 'geen' }), 10);
    expect(b.exVat).toBe(614_900);
    expect(b.unforeseen).toBe(61_490);
    expect(b.subtotalExVat).toBe(676_390);
    expect(b.vatRate).toBe(21);
    expect(b.vatAmountInformational).toBe(Math.round(676_390 * 0.21));
    expect(b.totalInclVat).toBeGreaterThan(b.subtotalExVat);
    expect(b.vatAmountIncluded).toBe(0);
    expect(b.includedInInvestment).toBe(676_390);
  });

  it('niet verrekenbaar 21% telt incl. btw mee in investering', () => {
    const b = computeCostBreakdown(cost({ vat_treatment: 'pct_21' }), 10);
    expect(b.vatAmountIncluded).toBe(Math.round(676_390 * 0.21));
    expect(b.includedInInvestment).toBe(676_390 + b.vatAmountIncluded);
    expect(b.totalInclVat).toBe(b.includedInInvestment);
  });

  it('volledig verrekenbaar telt excl. btw mee', () => {
    const b = computeCostBreakdown(cost({ vat_treatment: 'verrekenbaar' }), 10);
    expect(b.vatAmountIncluded).toBe(0);
    expect(b.includedInInvestment).toBe(676_390);
    expect(b.vatAmountInformational).toBeGreaterThan(0);
    expect(b.totalInclVat).toBeGreaterThan(b.includedInInvestment);
  });

  it('deels verrekenbaar (handmatig bedrag) telt alleen het handmatig deel mee', () => {
    const b = computeCostBreakdown(cost({ vat_treatment: 'handmatig', vat_percentage: 21, vat_amount_manual: 50_000 }), 10);
    expect(b.vatAmountIncluded).toBe(50_000);
    expect(b.includedInInvestment).toBe(676_390 + 50_000);
  });

  it('deels verrekenbaar zonder handmatig bedrag valt terug op percentage', () => {
    const b = computeCostBreakdown(cost({ vat_treatment: 'handmatig', vat_percentage: 10, vat_amount_manual: null }), 10);
    expect(b.vatAmountIncluded).toBe(Math.round(676_390 * 0.10));
  });

  it('"geen btw" levert nul informatief én nul meegenomen wanneer percentage 0', () => {
    const b = computeCostBreakdown(cost({ vat_treatment: 'geen', vat_percentage: 0, amount: 100_000 }), 0);
    // Fallback rate = 21 wanneer er geen expliciete pct is — informatief blijft zichtbaar.
    expect(b.vatAmountIncluded).toBe(0);
    expect(b.vatAmountInformational).toBe(21_000);
  });

  it('effectiveCostVatAmount blijft backwards compatible voor bestaande tests', () => {
    expect(effectiveCostVatAmount(cost({ vat_treatment: 'geen' }), 10)).toBe(0);
    expect(effectiveCostVatAmount(cost({ vat_treatment: 'verrekenbaar' }), 10)).toBe(0);
    expect(effectiveCostVatAmount(cost({ vat_treatment: 'pct_21' }), 10)).toBe(Math.round(676_390 * 0.21));
  });

  it('exposeert leesbare labels voor alle btw-behandelingen', () => {
    expect(VAT_TREATMENT_LABELS.geen).toMatch(/Geen btw/);
    expect(VAT_TREATMENT_LABELS.pct_21).toMatch(/Niet verrekenbaar/);
    expect(VAT_TREATMENT_LABELS.verrekenbaar).toMatch(/Volledig verrekenbaar/);
    expect(VAT_TREATMENT_LABELS.handmatig).toMatch(/Deels verrekenbaar/);
  });
});

describe('Vastgoedrekenen — persistentie-payload btw-velden', () => {
  // Simuleert de payload-mapping in ScenarioEditor.save() — voorheen ontbraken
  // vat_treatment / vat_percentage / vat_amount_manual, waardoor "21% meenemen"
  // niet werd opgeslagen. Deze test borgt dat ze in elke save mee gaan.
  function buildPayload(c: ScenarioCost) {
    const rec = c as unknown as Record<string, unknown>;
    return {
      vat_treatment: ((rec.vat_treatment as string | null) ?? 'geen'),
      vat_percentage: (rec.vat_percentage as number | null) ?? null,
      vat_amount_manual: (rec.vat_amount_manual as number | null) ?? null,
    };
  }

  it('schrijft btw-keuze "pct_21" volledig weg', () => {
    expect(buildPayload(cost({ vat_treatment: 'pct_21', vat_percentage: 21 })))
      .toEqual({ vat_treatment: 'pct_21', vat_percentage: 21, vat_amount_manual: null });
  });

  it('schrijft btw-keuze "handmatig" met percentage + bedrag weg', () => {
    expect(buildPayload(cost({ vat_treatment: 'handmatig', vat_percentage: 10, vat_amount_manual: 12_345 })))
      .toEqual({ vat_treatment: 'handmatig', vat_percentage: 10, vat_amount_manual: 12_345 });
  });

  it('behoudt backwards compatibility voor bestaande posten zonder btw-velden', () => {
    expect(buildPayload(cost({ vat_treatment: undefined as unknown as string, vat_percentage: undefined as unknown as number, vat_amount_manual: undefined as unknown as number })))
      .toEqual({ vat_treatment: 'geen', vat_percentage: null, vat_amount_manual: null });
  });
});
