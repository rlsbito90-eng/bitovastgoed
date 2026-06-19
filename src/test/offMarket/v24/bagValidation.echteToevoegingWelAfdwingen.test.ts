// V2.4 — echte toevoeging in signaal moet wel afgedwongen blijven.
import { describe, it, expect } from 'vitest';
import { validateDoelobject } from '@/lib/offMarket/bag/validateDoelobject';

describe('validateDoelobject — echte toevoeging blijft afgedwongen', () => {
  const signaal = { adres: 'Apollolaan 33-H Amsterdam', titel: null, postcode: null };
  it('weigert Apollolaan 33-1 als doelobject', () => {
    const r = validateDoelobject(signaal, {
      postcode: null, huisnummer: '33', huisletter: null, huisnummertoevoeging: '1',
    });
    expect(r.ok).toBe(false);
    expect(r.reden).toMatch(/toevoeging/);
  });
  it('accepteert Apollolaan 33-H', () => {
    const r = validateDoelobject(signaal, {
      postcode: null, huisnummer: '33', huisletter: 'H', huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(true);
  });
});
