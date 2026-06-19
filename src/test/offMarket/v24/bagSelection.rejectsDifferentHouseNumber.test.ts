// V2.4 — validateDoelobject weigert kandidaten met ander basis-huisnummer of postcode.
import { describe, it, expect } from 'vitest';
import { validateDoelobject } from '@/lib/offMarket/bag/validateDoelobject';

const signaal = {
  adres: 'Prinsengracht 202-H',
  postcode: '1015 DT',
  titel: 'Prinsengracht 202-H',
};

describe('validateDoelobject — strikte huisnummer/postcode-validatie', () => {
  it('weigert ander huisnummer (202 vs 237)', () => {
    const r = validateDoelobject(signaal, {
      postcode: '1015DT',
      huisnummer: '237',
      huisletter: 'H',
      huisnummertoevoeging: 'A',
    });
    expect(r.ok).toBe(false);
    expect(r.reden).toMatch(/huisnummer/i);
  });

  it('weigert andere postcode', () => {
    const r = validateDoelobject(signaal, {
      postcode: '1071XX',
      huisnummer: '202',
      huisletter: 'H',
      huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(false);
    expect(r.reden).toMatch(/postcode/i);
  });

  it('weigert verkeerde toevoeging als signaal -H heeft', () => {
    const r = validateDoelobject(signaal, {
      postcode: '1015DT',
      huisnummer: '202',
      huisletter: null,
      huisnummertoevoeging: '1',
    });
    expect(r.ok).toBe(false);
    expect(r.reden).toMatch(/toevoeging/i);
  });

  it('accepteert exact matchende 202-H', () => {
    const r = validateDoelobject(signaal, {
      postcode: '1015DT',
      huisnummer: '202',
      huisletter: 'H',
      huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(true);
  });

  it('accepteert signaal zonder toevoeging als kandidaat geen toevoeging heeft', () => {
    const s = { adres: 'Hoofdstraat 100', titel: 'Hoofdstraat 100', postcode: '1234AB' };
    const r = validateDoelobject(s, {
      postcode: '1234AB',
      huisnummer: '100',
      huisletter: null,
      huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(true);
  });

  it('weigert ook nearby (basis-huisnummer 237) ook als doelobject', () => {
    const r = validateDoelobject(signaal, {
      postcode: '1015DT',
      huisnummer: '237',
      huisletter: 'H',
      huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(false);
  });

  it('accepteert toevoeging "1" voor Govert Flinckstraat 330-1', () => {
    const s = { adres: 'Govert Flinckstraat 330-1', titel: 'Govert Flinckstraat 330-1', postcode: '1074CE' };
    const r = validateDoelobject(s, {
      postcode: '1074CE',
      huisnummer: '330',
      huisletter: null,
      huisnummertoevoeging: '1',
    });
    expect(r.ok).toBe(true);
  });
});
