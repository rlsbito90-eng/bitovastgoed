import { describe, it, expect } from 'vitest';
import {
  safeNumber,
  safeDivide,
  calculateMonthlyRent,
  calculateAnnualFromMonthly,
  calculatePricePerM2,
  calculateRentPerM2,
  calculateBAR,
  calculateFactor,
  calculateNAR,
  resolveDerived,
  resolveBAR,
  resolveNOI,
} from '@/lib/derivations/financial';

describe('financial — safeNumber / safeDivide', () => {
  it('filtert NaN, Infinity en niet-numerieke input', () => {
    expect(safeNumber(NaN)).toBeNull();
    expect(safeNumber(Infinity)).toBeNull();
    expect(safeNumber(-Infinity)).toBeNull();
    expect(safeNumber('abc')).toBeNull();
    expect(safeNumber(null)).toBeNull();
    expect(safeNumber(undefined)).toBeNull();
    expect(safeNumber('')).toBeNull();
    expect(safeNumber('12.5')).toBe(12.5);
    expect(safeNumber(0)).toBe(0);
  });

  it('safeDivide: deelt veilig, geen NaN/Infinity', () => {
    expect(safeDivide(10, 0)).toBeNull();
    expect(safeDivide(10, -1)).toBeNull();
    expect(safeDivide(null, 5)).toBeNull();
    expect(safeDivide(10, 2)).toBe(5);
  });
});

describe('financial — afleidingen', () => {
  it('maandhuur uit jaarhuur 72.000 = 6.000', () => {
    expect(calculateMonthlyRent(72000)).toBe(6000);
  });

  it('jaarhuur uit maandhuur 6.000 = 72.000', () => {
    expect(calculateAnnualFromMonthly(6000)).toBe(72000);
  });

  it('BAR: jaarhuur 60.000 / vraagprijs 1.000.000 = 6', () => {
    expect(calculateBAR(60000, 1_000_000)).toBe(6);
  });

  it('factor: vraagprijs 1.000.000 / jaarhuur 60.000 ≈ 16.6667', () => {
    const f = calculateFactor(1_000_000, 60000);
    expect(f).not.toBeNull();
    expect(f!).toBeCloseTo(16.6667, 3);
  });

  it('NAR: NOI 50.000 / vraagprijs 1.000.000 = 5', () => {
    expect(calculateNAR(50000, 1_000_000)).toBe(5);
  });

  it('huur/m² en €/m²', () => {
    expect(calculateRentPerM2(60000, 500)).toBe(120);
    expect(calculatePricePerM2(1_000_000, 500)).toBe(2000);
  });

  it('ontbrekende / 0 input geeft null, geen NaN/Infinity', () => {
    expect(calculateBAR(undefined, 1000)).toBeNull();
    expect(calculateBAR(1000, 0)).toBeNull();
    expect(calculateFactor(1000, 0)).toBeNull();
    expect(calculateMonthlyRent(0)).toBeNull();
    expect(calculateRentPerM2(60000, 0)).toBeNull();
    expect(calculatePricePerM2(1000, undefined)).toBeNull();
  });
});

describe('financial — resolveDerived (override-model)', () => {
  it('zonder override wint auto', () => {
    const r = resolveDerived(6, undefined);
    expect(r.value).toBe(6);
    expect(r.source).toBe('auto');
    expect(r.mismatch).toBe(false);
  });

  it('met override wint override en delta wordt berekend', () => {
    const r = resolveDerived(6, 6.5);
    expect(r.source).toBe('override');
    expect(r.value).toBe(6.5);
    expect(r.delta).toBeCloseTo(0.5, 6);
    expect(r.mismatch).toBe(true);
  });

  it('source=none als beide null', () => {
    const r = resolveDerived(null, null);
    expect(r.value).toBeNull();
    expect(r.source).toBe('none');
  });

  it('resolveBAR werkt als compositie', () => {
    const r = resolveBAR(60000, 1_000_000, undefined);
    expect(r.value).toBe(6);
    expect(r.source).toBe('auto');
  });

  it('resolveNOI: jaarhuur − servicekosten', () => {
    const r = resolveNOI(100000, 20000, undefined);
    expect(r.value).toBe(80000);
    const o = resolveNOI(100000, 20000, 75000);
    expect(o.source).toBe('override');
    expect(o.value).toBe(75000);
    expect(o.delta).toBe(-5000);
  });
});
