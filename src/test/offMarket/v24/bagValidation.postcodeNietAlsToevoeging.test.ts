// V2.4 — postcode mag nooit als huisletter/toevoeging worden geparset,
// en signalen zonder echte toevoeging accepteren elke subkandidaat
// binnen postcode + basis-huisnummer.
import { describe, it, expect } from 'vitest';
import { validateDoelobject } from '@/lib/offMarket/bag/validateDoelobject';

describe('validateDoelobject — postcode niet als toevoeging', () => {
  const signaal = {
    adres: 'Taksteeg 11',
    postcode: '1012PB',
    titel: 'Taksteeg 11 1012PB Amsterdam',
  };

  it('accepteert Taksteeg 11-H als subkandidaat van basisadres', () => {
    const res = validateDoelobject(signaal, {
      postcode: '1012PB', huisnummer: '11', huisletter: 'H', huisnummertoevoeging: null,
    });
    expect(res.ok).toBe(true);
  });

  it('accepteert Taksteeg 11-1 als subkandidaat van basisadres', () => {
    const res = validateDoelobject(signaal, {
      postcode: '1012PB', huisnummer: '11', huisletter: null, huisnummertoevoeging: '1',
    });
    expect(res.ok).toBe(true);
  });

  it('weigert ander huisnummer (13A) bij signaal Taksteeg 11', () => {
    const res = validateDoelobject(signaal, {
      postcode: '1012PB', huisnummer: '13', huisletter: 'A', huisnummertoevoeging: null,
    });
    expect(res.ok).toBe(false);
    expect(res.reden).toMatch(/huisnummer/);
  });

  it('handhaaft echte toevoeging als signaal expliciet 11-H is', () => {
    const sig = { adres: 'Taksteeg 11-H', postcode: '1012PB', titel: 'Taksteeg 11-H 1012PB Amsterdam' };
    const okH = validateDoelobject(sig, {
      postcode: '1012PB', huisnummer: '11', huisletter: 'H', huisnummertoevoeging: null,
    });
    expect(okH.ok).toBe(true);
    const nokToev1 = validateDoelobject(sig, {
      postcode: '1012PB', huisnummer: '11', huisletter: null, huisnummertoevoeging: '1',
    });
    expect(nokToev1.ok).toBe(false);
  });

  it('herkent toevoeging nog correct bij Govert Flinckstraat 330-1', () => {
    const sig = { adres: 'Govert Flinckstraat 330-1', postcode: '1074CE', titel: null };
    const ok = validateDoelobject(sig, {
      postcode: '1074CE', huisnummer: '330', huisletter: null, huisnummertoevoeging: '1',
    });
    expect(ok.ok).toBe(true);
  });
});
