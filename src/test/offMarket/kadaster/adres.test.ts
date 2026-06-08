// V1A — Adresnormalisatie, toevoeging-splitsing, zoekvarianten, complex-detectie
import { describe, it, expect } from 'vitest';
import {
  normaliseerAdres, normaliseerPostcode, splitHuisnummer,
  bouwZoekvarianten, detecteerComplexiteit,
} from '@/lib/offMarket/kadaster/adres';

describe('normaliseerPostcode', () => {
  it('formatteert met spatie + hoofdletters', () => {
    expect(normaliseerPostcode('1057db')).toBe('1057 DB');
    expect(normaliseerPostcode('1057 db')).toBe('1057 DB');
    expect(normaliseerPostcode('zomaar')).toBe(null);
    expect(normaliseerPostcode(null)).toBe(null);
  });
});

describe('splitHuisnummer', () => {
  it('splitst 160-H naar 160 + H', () => {
    expect(splitHuisnummer('160-H')).toEqual({ huisnummer: '160', toevoeging: 'H' });
  });
  it('splitst 162-1 naar 162 + 1', () => {
    expect(splitHuisnummer('162-1')).toEqual({ huisnummer: '162', toevoeging: '1' });
  });
  it('houdt los huisnummer als-is', () => {
    expect(splitHuisnummer('160')).toEqual({ huisnummer: '160', toevoeging: null });
  });
  it('herkent 12A zonder streepje', () => {
    expect(splitHuisnummer('12A')).toEqual({ huisnummer: '12', toevoeging: 'A' });
  });
});

describe('normaliseerAdres', () => {
  it('haalt straat/huisnummer/toevoeging/postcode/plaats uit origineel', () => {
    const r = normaliseerAdres({ origineel: 'Hoofdweg 160-H 1057 DB Amsterdam' });
    expect(r.straat).toBe('Hoofdweg');
    expect(r.huisnummer).toBe('160');
    expect(r.toevoeging).toBe('H');
    expect(r.postcode).toBe('1057 DB');
    expect(r.plaats).toBe('Amsterdam');
    expect(r.origineel).toBe('Hoofdweg 160-H 1057 DB Amsterdam');
  });

  it('respecteert reeds gestructureerde velden', () => {
    const r = normaliseerAdres({
      origineel: 'iets anders',
      straat: 'Damrak', huisnummer: '1', postcode: '1012 LG', plaats: 'Amsterdam',
    });
    expect(r.straat).toBe('Damrak');
    expect(r.huisnummer).toBe('1');
    expect(r.postcode).toBe('1012 LG');
  });

  it('splitst samengesteld huisnummer als toevoeging mee komt', () => {
    const r = normaliseerAdres({ huisnummer: '160-H' });
    expect(r.huisnummer).toBe('160');
    expect(r.toevoeging).toBe('H');
  });
});

describe('bouwZoekvarianten', () => {
  it('genereert brede + exacte varianten incl. origineel fallback', () => {
    const adres = normaliseerAdres({ origineel: 'Hoofdweg 160-H 1057 DB Amsterdam' });
    const v = bouwZoekvarianten(adres);
    const ids = v.map(x => x.id);
    expect(ids).toContain('straat-huisnummer-plaats');
    expect(ids).toContain('postcode-huisnummer');
    expect(ids).toContain('volledig-zonder-toevoeging');
    expect(ids).toContain('straat-huisnummer-toevoeging-plaats');
    expect(ids).toContain('postcode-huisnummer-toevoeging');
    expect(ids).toContain('origineel');
  });

  it('brede varianten komen vóór exacte', () => {
    const adres = normaliseerAdres({ origineel: 'Hoofdweg 160-H 1057 DB Amsterdam' });
    const v = bouwZoekvarianten(adres);
    const breed = v.findIndex(x => x.id === 'straat-huisnummer-plaats');
    const exact = v.findIndex(x => x.id === 'straat-huisnummer-toevoeging-plaats');
    expect(breed).toBeLessThan(exact);
  });

  it('slaat varianten over als data ontbreekt', () => {
    const adres = normaliseerAdres({ straat: 'Damrak', huisnummer: '1' });
    const ids = bouwZoekvarianten(adres).map(v => v.id);
    expect(ids).not.toContain('straat-huisnummer-plaats');
    expect(ids).not.toContain('postcode-huisnummer');
  });
});

describe('detecteerComplexiteit', () => {
  it('markeert "162 en 163" als complex', () => {
    const adres = normaliseerAdres({ origineel: 'Baarsjesweg 162 en 163, Amsterdam' });
    const c = detecteerComplexiteit(adres);
    expect(c.complex).toBe(true);
    expect(c.redenen).toContain('meerdere_huisnummers');
  });

  it('markeert "12-14" als range', () => {
    const adres = normaliseerAdres({ origineel: 'Damrak 12-14, 1012 LG Amsterdam' });
    expect(detecteerComplexiteit(adres).redenen).toContain('huisnummer_range');
  });

  it('markeert ontbrekend huisnummer', () => {
    const adres = normaliseerAdres({ straat: 'Damrak', plaats: 'Amsterdam' });
    expect(detecteerComplexiteit(adres).complex).toBe(true);
  });

  it('normaal adres is niet complex', () => {
    const adres = normaliseerAdres({ origineel: 'Hoofdweg 160-H 1057 DB Amsterdam' });
    expect(detecteerComplexiteit(adres).complex).toBe(false);
  });
});
