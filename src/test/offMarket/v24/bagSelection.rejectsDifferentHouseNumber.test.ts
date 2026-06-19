// V2.4 — validateDoelobject weigert kandidaten met ander basis-huisnummer of postcode.
import { describe, it, expect } from 'vitest';
import { validateDoelobject } from '../../../../supabase/functions/off-market-bag-verrijk/index.ts';

const signaal = {
  id: 's1',
  adres: 'Prinsengracht 202-H',
  postcode: '1015 DT',
  plaats: 'Amsterdam',
  titel: 'Prinsengracht 202-H',
  bag_status: null,
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

  it('weigert ontbrekende toevoeging als signaal -H heeft', () => {
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

  it('accepteert signaal zonder toevoeging als kandidaat ook geen toevoeging heeft', () => {
    const s = { ...signaal, adres: 'Hoofdstraat 100', titel: 'Hoofdstraat 100', postcode: '1234AB' };
    const r = validateDoelobject(s, {
      postcode: '1234AB',
      huisnummer: '100',
      huisletter: null,
      huisnummertoevoeging: null,
    });
    expect(r.ok).toBe(true);
  });
});
