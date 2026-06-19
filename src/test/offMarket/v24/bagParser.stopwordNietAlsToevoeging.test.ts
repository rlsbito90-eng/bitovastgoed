// V2.4 — parser mag stopwoorden zoals "in", "te", plaatsnamen NIET als toevoeging lezen.
import { describe, it, expect } from 'vitest';
import { parseSignaalAdres, isRealToevoeging } from '@/lib/offMarket/bag/validateDoelobject';

describe('parseSignaalAdres — stopwoord niet als toevoeging', () => {
  for (const adres of [
    'Apollolaan 33 in Amsterdam',
    'Apollolaan 33 te Amsterdam',
    'Apollolaan 33 Amsterdam',
    'Apollolaan 33, Amsterdam',
    'Apollolaan 33 in AMSTERDAM',
    'voor splitsingsvergunning Verleend - Apollolaan 33 in Amsterdam',
  ]) {
    it(`"${adres}" → huisnummer 33, geen toevoeging`, () => {
      const p = parseSignaalAdres({ adres, titel: adres, postcode: null });
      expect(p.huisnummer).toBe('33');
      expect(p.huisletter).toBeNull();
      expect(p.toevoeging).toBeNull();
    });
  }
  it('isRealToevoeging weigert IN/TE/AMSTERDAM', () => {
    expect(isRealToevoeging('IN')).toBe(false);
    expect(isRealToevoeging('TE')).toBe(false);
    expect(isRealToevoeging('AMSTERDAM')).toBe(false);
    expect(isRealToevoeging('Den')).toBe(false);
  });
});
