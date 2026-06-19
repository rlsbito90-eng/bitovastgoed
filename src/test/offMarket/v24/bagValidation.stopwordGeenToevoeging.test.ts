// V2.4 — stopwoord IN/TE/plaatsnaam blokkeert geen geldige kandidaten.
import { describe, it, expect } from 'vitest';
import { validateDoelobject } from '@/lib/offMarket/bag/validateDoelobject';

describe('validateDoelobject — stopwoord geen toevoeging', () => {
  const signaal = { adres: 'Apollolaan 33 in Amsterdam', titel: 'Apollolaan 33 in Amsterdam', postcode: null };
  it('accepteert Apollolaan 33-H (signaal heeft geen echte toevoeging)', () => {
    const r = validateDoelobject(signaal, {
      postcode: null, huisnummer: '33', huisletter: 'H', huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(true);
  });
  it('accepteert Apollolaan 33-1', () => {
    const r = validateDoelobject(signaal, {
      postcode: null, huisnummer: '33', huisletter: null, huisnummertoevoeging: '1',
    });
    expect(r.ok).toBe(true);
  });
  it('weigert nog steeds ander huisnummer 35', () => {
    const r = validateDoelobject(signaal, {
      postcode: null, huisnummer: '35', huisletter: 'H', huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(false);
    expect(r.reden).toMatch(/huisnummer/);
  });
});
