import { describe, it, expect } from 'vitest';
import {
  selectBuyerFeeTier,
  computeBitoBuyerFee,
  resolveBuyerFeeBasis,
  BITO_BUYER_FEE_TIERS,
} from '@/lib/vastgoedrekenen/fees/buyerFeeStaffel';
import type { Scenario } from '@/lib/vastgoedrekenen/types';

const scen = (overrides: Partial<Scenario>) => ({ ...overrides } as unknown as Scenario);

describe('Bito aankoopfee-staffel — grenzen', () => {
  it('€ 1 valt in 2,0%', () => {
    expect(selectBuyerFeeTier(1).pctExVat).toBe(2.0);
  });
  it('exact € 1.000.000 valt in 2,0%', () => {
    expect(selectBuyerFeeTier(1_000_000).pctExVat).toBe(2.0);
  });
  it('€ 1.000.001 valt in 1,5%', () => {
    expect(selectBuyerFeeTier(1_000_001).pctExVat).toBe(1.5);
  });
  it('exact € 3.000.000 valt in 1,5%', () => {
    expect(selectBuyerFeeTier(3_000_000).pctExVat).toBe(1.5);
  });
  it('€ 3.000.001 valt in 1,0%', () => {
    expect(selectBuyerFeeTier(3_000_001).pctExVat).toBe(1.0);
  });
  it('schijven dekken alles aaneengesloten', () => {
    expect(BITO_BUYER_FEE_TIERS).toHaveLength(3);
    expect(BITO_BUYER_FEE_TIERS[2].maxInclusive).toBeNull();
  });
});

describe('Bito aankoopfee-staffel — voorbeeld € 2.300.000', () => {
  const r = computeBitoBuyerFee(scen({ purchase_price: 2_300_000, buyer_fee_vat_percentage: 21 }));
  it('1,5% van € 2.300.000 = € 34.500 ex. btw', () => expect(r.amountExVat).toBe(34_500));
  it('btw 21% = € 7.245', () => expect(r.vatAmount).toBe(7_245));
  it('incl. btw = € 41.745', () => expect(r.amountInclVat).toBe(41_745));
  it('staffelregel is 1,5%-schijf', () => expect(r.tier?.pctExVat).toBe(1.5));
});

describe('resolveBuyerFeeBasis', () => {
  it('beoogde aankoopprijs wint van vraagprijs', () => {
    const r = resolveBuyerFeeBasis(scen({ purchase_price: 500_000, asking_price: 900_000 }));
    expect(r.basis).toBe(500_000);
    expect(r.source).toBe('beoogde_aankoopprijs');
  });
  it('valt terug op vraagprijs als beoogde aankoopprijs ontbreekt', () => {
    const r = resolveBuyerFeeBasis(scen({ purchase_price: 0, asking_price: 900_000 }));
    expect(r.basis).toBe(900_000);
    expect(r.source).toBe('vraagprijs');
  });
  it('ontbreekt als beide leeg zijn', () => {
    const r = resolveBuyerFeeBasis(scen({ purchase_price: 0, asking_price: 0 }));
    expect(r.source).toBe('ontbreekt');
  });
});

describe('btw-override', () => {
  it('btw 9% in plaats van 21%', () => {
    const r = computeBitoBuyerFee(scen({ purchase_price: 500_000, buyer_fee_vat_percentage: 9 }));
    expect(r.amountExVat).toBe(10_000);
    expect(r.vatAmount).toBe(900);
    expect(r.amountInclVat).toBe(10_900);
  });
});
