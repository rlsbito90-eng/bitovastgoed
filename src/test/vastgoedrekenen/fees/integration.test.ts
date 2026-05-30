import { describe, it, expect } from 'vitest';
import { computeAcquisitionCosts, computeTotalInvestment } from '@/lib/vastgoedrekenen/investering';
import type { Scenario } from '@/lib/vastgoedrekenen/types';

const scen = (overrides: Partial<Scenario> & Record<string, unknown>) =>
  ({
    buyer_fee_vat_percentage: 21,
    advisory_costs: 0,
    due_diligence_costs: 0,
    other_acquisition_costs: 0,
    safety_margin: 0,
    notary_costs: 0,
    manual_zero_fields: [],
    ...overrides,
  } as unknown as Scenario);

describe('computeAcquisitionCosts — buyer_fee_method', () => {
  it('staffel + € 2,3M → fee 34.500 + btw 7.245', () => {
    const r = computeAcquisitionCosts(scen({ purchase_price: 2_300_000, buyer_fee_method: 'staffel' }));
    expect(r.buyerFeeBase).toBe(34_500);
    expect(r.buyerFeeVat).toBe(7_245);
    expect(r.totalAcquisitionCosts).toBe(41_745);
  });
  it('staffel + alleen vraagprijs → gebruikt vraagprijs als basis', () => {
    const r = computeAcquisitionCosts(scen({ purchase_price: 0, asking_price: 800_000, buyer_fee_method: 'staffel' }));
    // 2,0% van 800k = 16.000 + 21% btw = 3.360
    expect(r.buyerFeeBase).toBe(16_000);
    expect(r.buyerFeeVat).toBe(3_360);
  });
  it('zero → fee 0 ongeacht andere velden', () => {
    const r = computeAcquisitionCosts(scen({ purchase_price: 2_000_000, buyer_fee_percentage: 2, buyer_fee_method: 'zero' }));
    expect(r.buyerFeeBase).toBe(0);
    expect(r.buyerFeeVat).toBe(0);
  });
  it('manual (default) gebruikt bestaande pct → identiek aan vorige logica', () => {
    const r = computeAcquisitionCosts(scen({ purchase_price: 1_000_000, buyer_fee_percentage: 2, buyer_fee_method: 'manual' }));
    expect(r.buyerFeeBase).toBe(20_000);
    expect(r.buyerFeeVat).toBe(4_200);
  });
  it('zonder method-veld behandelen als manual (backwards compat)', () => {
    const r = computeAcquisitionCosts(scen({ purchase_price: 1_000_000, buyer_fee_percentage: 2 }));
    expect(r.buyerFeeBase).toBe(20_000);
  });
  it('manual met buyer_fee_amount blijft leidend', () => {
    const r = computeAcquisitionCosts(scen({ purchase_price: 1_000_000, buyer_fee_amount: 15_000, buyer_fee_method: 'manual' }));
    expect(r.buyerFeeBase).toBe(15_000);
  });
});

describe('computeAcquisitionCosts — notary_costs_method', () => {
  it('profile woning_belegging € 1M → 2500', () => {
    const r = computeAcquisitionCosts(scen({
      purchase_price: 1_000_000,
      buyer_fee_method: 'zero',
      notary_costs_method: 'profile',
      notary_costs_profile: 'woning_belegging',
    }));
    expect(r.totalAcquisitionCosts).toBe(2500);
  });
  it('profile commercieel € 4M → 6000', () => {
    const r = computeAcquisitionCosts(scen({
      purchase_price: 4_000_000,
      buyer_fee_method: 'zero',
      notary_costs_method: 'profile',
      notary_costs_profile: 'commercieel',
    }));
    expect(r.totalAcquisitionCosts).toBe(6000);
  });
  it('manual gebruikt notary_costs-veld', () => {
    const r = computeAcquisitionCosts(scen({
      purchase_price: 1_000_000,
      notary_costs: 1500,
      buyer_fee_method: 'zero',
      notary_costs_method: 'manual',
    }));
    expect(r.totalAcquisitionCosts).toBe(1500);
  });
  it('zero negeert notary_costs', () => {
    const r = computeAcquisitionCosts(scen({
      purchase_price: 1_000_000,
      notary_costs: 9999,
      buyer_fee_method: 'zero',
      notary_costs_method: 'zero',
    }));
    expect(r.totalAcquisitionCosts).toBe(0);
  });
});

describe('totale investering bevat fee incl. btw', () => {
  it('staffel-fee incl. btw stroomt door naar totale investering', () => {
    const s = scen({ purchase_price: 2_300_000, buyer_fee_method: 'staffel', notary_costs_method: 'zero' });
    const acq = computeAcquisitionCosts(s);
    const ti = computeTotalInvestment({
      purchasePrice: 2_300_000,
      totalTransferTax: 0,
      totalAcquisitionCosts: acq.totalAcquisitionCosts,
      totalCosts: 0,
      financingCosts: 0,
    });
    expect(ti).toBe(2_300_000 + 41_745);
  });
});
