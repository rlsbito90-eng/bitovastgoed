import { describe, it, expect } from 'vitest';
import { parseDutchNumber, formatNumberNL, formatPercentage, formatCurrency, formatFactor } from '@/lib/format/nl';

describe('parseDutchNumber — comma & dot decimal handling', () => {
  it('accepteert komma als decimaal', () => {
    expect(parseDutchNumber('2,4')).toBe(2.4);
    expect(parseDutchNumber('41,7')).toBe(41.7);
    expect(parseDutchNumber('1300,50')).toBe(1300.5);
  });
  it('accepteert punt als decimaal', () => {
    expect(parseDutchNumber('2.4')).toBe(2.4);
    expect(parseDutchNumber('41.7')).toBe(41.7);
    expect(parseDutchNumber('1300.50')).toBe(1300.5);
  });
  it('accepteert Nederlandse duizendscheidingen', () => {
    expect(parseDutchNumber('1.625.000')).toBe(1625000);
    expect(parseDutchNumber('1.000.000,50')).toBe(1000000.5);
  });
  it('accepteert €, %, m² en spaties', () => {
    expect(parseDutchNumber('€ 1.625.000')).toBe(1625000);
    expect(parseDutchNumber('6,5%')).toBe(6.5);
    expect(parseDutchNumber('927,41 m²')).toBe(927.41);
    expect(parseDutchNumber('16,4x')).toBe(16.4);
  });
  it('lege of ongeldige invoer geeft null (geen NaN, geen 0)', () => {
    expect(parseDutchNumber('')).toBeNull();
    expect(parseDutchNumber('   ')).toBeNull();
    expect(parseDutchNumber(null)).toBeNull();
    expect(parseDutchNumber(undefined)).toBeNull();
    expect(parseDutchNumber('abc')).toBeNull();
    expect(parseDutchNumber('-')).toBeNull();
    expect(parseDutchNumber(',')).toBeNull();
  });
  it('round-trip waarden blijven stabiel', () => {
    const v = parseDutchNumber('2,4');
    expect(v).toBe(2.4);
    expect(parseDutchNumber(String(v).replace('.', ','))).toBe(2.4);
  });
});

describe('NL formatters — UI gebruikt komma', () => {
  it('formatNumberNL gebruikt komma als decimaal', () => {
    expect(formatNumberNL(2.4, 1)).toBe('2,4');
    expect(formatNumberNL(1625000, 0)).toBe('1.625.000');
  });
  it('formatPercentage gebruikt komma + % suffix', () => {
    expect(formatPercentage(6.5, 1)).toBe('6,5%');
    expect(formatPercentage(4.43, 2)).toBe('4,43%');
  });
  it('formatCurrency gebruikt € + nl scheidingen', () => {
    expect(formatCurrency(1625000, 0)).toBe('€ 1.625.000');
  });
  it('formatFactor gebruikt komma + x', () => {
    expect(formatFactor(41.7, 1)).toBe('41,7x');
  });
});
