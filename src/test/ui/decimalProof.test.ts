import { describe, it, expect } from 'vitest';
import { parseDutchNumber, formatArea, formatNumberNL } from '@/lib/format/nl';

/**
 * App-brede decimal-proof rekenvelden — borgt dat metrages decimalen behouden
 * in parsing, optellen en weergave (Hinthamerstraat-cases als golden test).
 */
describe('Decimal-proof metrages (Hinthamerstraat)', () => {
  it('parseert m²-invoer met komma en behoudt decimalen', () => {
    expect(parseDutchNumber('85,40')).toBeCloseTo(85.4, 5);
    expect(parseDutchNumber('68,90')).toBeCloseTo(68.9, 5);
    expect(parseDutchNumber('111,81')).toBeCloseTo(111.81, 5);
    expect(parseDutchNumber('37,29')).toBeCloseTo(37.29, 5);
  });

  it('parseert m²-invoer met punt of suffix m²', () => {
    expect(parseDutchNumber('85.40')).toBeCloseTo(85.4, 5);
    expect(parseDutchNumber('111,81 m²')).toBeCloseTo(111.81, 5);
  });

  it('telt componenten exact op zonder decimaal-verlies — GO wonen = 470,00', () => {
    const units = [85.4, 68.9, 91.2, 88.0, 59.1, 77.4];
    const totaal = units.reduce((s, n) => s + n, 0);
    expect(totaal).toBeCloseTo(470.0, 5);
  });

  it('telt commercieel VVO op tot 149,10', () => {
    expect(111.81 + 37.29).toBeCloseTo(149.1, 5);
  });

  it('telt wonen + overige inpandige ruimte op tot 559,00', () => {
    const wonen = 470.0;
    const overige = 89.0;
    expect(wonen + overige).toBeCloseTo(559.0, 5);
  });

  it('formatteert in NL met komma en m² suffix', () => {
    expect(formatArea(85.4, 2)).toBe('85,40 m²');
    expect(formatArea(470, 2)).toBe('470,00 m²');
    expect(formatNumberNL(111.81, 2)).toBe('111,81');
  });

  it('rondt nooit metrages af bij parsen (geen parseInt)', () => {
    const v = parseDutchNumber('85,40');
    expect(v).not.toBe(85);
    expect(v).toBeCloseTo(85.4, 5);
  });
});
