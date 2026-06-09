import { describe, it, expect } from 'vitest';
import { parseDutchNumber } from '@/lib/format/nl';

/**
 * Borgt dat biedbedragen met Nederlandse duizendscheidingen ("1.350.000")
 * correct geparsed worden naar 1_350_000 — niet 1.35 zoals parseFloat zou doen.
 */
describe('OfferFormDialog — Dutch amount parsing', () => {
  it('parseert "1.350.000" als 1.350.000', () => {
    expect(parseDutchNumber('1.350.000')).toBe(1350000);
  });
  it('parseert "1.350.000,50" als 1.350.000,50', () => {
    expect(parseDutchNumber('1.350.000,50')).toBe(1350000.5);
  });
  it('parseert "10,5" (waarborg %) correct', () => {
    expect(parseDutchNumber('10,5')).toBe(10.5);
  });
  it('lege waarde → null, geen 0/NaN', () => {
    expect(parseDutchNumber('')).toBeNull();
  });
});
