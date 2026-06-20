// V2.5 — Backend validateDoelobject blijft als laatste gate verkeerd basis-huisnummer weigeren.
import { describe, it, expect } from 'vitest';
import { validateDoelobject } from '@/lib/offMarket/bag/validateDoelobject';

describe('V2.5 backend validateDoelobject — verkeerd basis-huisnummer', () => {
  it('signaal 44-H weigert kandidaat huisnummer 1', () => {
    const r = validateDoelobject(
      { adres: 'Teststraat 44-H', titel: 'Teststraat 44-H', postcode: null },
      { postcode: '1234AB', huisnummer: '1', huisletter: null, huisnummertoevoeging: 'H' },
    );
    expect(r.ok).toBe(false);
    expect(r.reden ?? '').toMatch(/huisnummer/i);
  });

  it('signaal 44-H accepteert kandidaat 44 met toevoeging H (kruisgewijs)', () => {
    const r = validateDoelobject(
      { adres: 'Teststraat 44-H', titel: 'Teststraat 44-H', postcode: null },
      { postcode: null, huisnummer: '44', huisletter: null, huisnummertoevoeging: 'H' },
    );
    expect(r.ok).toBe(true);
  });
});
