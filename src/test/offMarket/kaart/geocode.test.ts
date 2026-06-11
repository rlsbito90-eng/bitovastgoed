import { describe, it, expect } from 'vitest';
import {
  parseAdres, bouwQuery, beoordeelKandidaten,
  type GeocodeKandidaat,
} from '@/lib/offMarket/kaart/geocode';

describe('parseAdres', () => {
  it('parseert straat + huisnummer', () => {
    expect(parseAdres('Sarphatistraat 90')).toEqual({ straat: 'Sarphatistraat', huisnummer: '90', toevoeging: null });
  });
  it('parseert huisletter', () => {
    expect(parseAdres('Damrak 1A')).toEqual({ straat: 'Damrak', huisnummer: '1', toevoeging: 'A' });
  });
  it('parseert toevoeging na streep', () => {
    expect(parseAdres('Sarphatipark 86-2')).toEqual({ straat: 'Sarphatipark', huisnummer: '86', toevoeging: '2' });
  });
  it('geeft null voor leeg adres', () => {
    expect(parseAdres('')).toEqual({ straat: null, huisnummer: null, toevoeging: null });
  });
});

describe('bouwQuery', () => {
  it('vereist huisnummer + (postcode of plaats)', () => {
    expect(bouwQuery({ adres: 'Damrak', postcode: '1012AB', plaats: 'Amsterdam' })).toBeNull();
    expect(bouwQuery({ adres: 'Damrak 1', postcode: null, plaats: null })).toBeNull();
  });
  it('bouwt query met postcode+huisnummer+plaats', () => {
    const q = bouwQuery({ adres: 'Damrak 1', postcode: '1012AB', plaats: 'Amsterdam' });
    expect(q).toContain('1012 AB');
    expect(q).toContain('Damrak');
    expect(q).toContain('1');
    expect(q).toContain('Amsterdam');
  });
});

function kand(p: Partial<GeocodeKandidaat>): GeocodeKandidaat {
  return {
    id: p.id ?? 'x', weergavenaam: p.weergavenaam ?? '',
    straat: p.straat ?? null, huisnummer: p.huisnummer ?? null,
    postcode: p.postcode ?? null, woonplaats: p.woonplaats ?? null,
    lat: p.lat ?? 52.37, lng: p.lng ?? 4.9, score: p.score ?? 10, type: p.type ?? 'adres',
  };
}

describe('beoordeelKandidaten', () => {
  const inv = { adres: 'Damrak 1', postcode: '1012AB', plaats: 'Amsterdam' };

  it('auto: enige kandidaat, huisnummer + postcode match', () => {
    const r = beoordeelKandidaten(inv, [kand({ huisnummer: '1', postcode: '1012AB', woonplaats: 'Amsterdam' })]);
    expect(r.status).toBe('auto');
  });

  it('controleren bij afwijkend huisnummer', () => {
    const r = beoordeelKandidaten(inv, [kand({ huisnummer: '5', postcode: '1012AB', woonplaats: 'Amsterdam' })]);
    expect(r.status).toBe('controleren');
  });

  it('controleren bij postcode en plaats mismatch', () => {
    const r = beoordeelKandidaten(inv, [kand({ huisnummer: '1', postcode: '9999ZZ', woonplaats: 'Groningen' })]);
    expect(r.status).toBe('controleren');
  });

  it('geen bij lege lijst', () => {
    const r = beoordeelKandidaten(inv, []);
    expect(r.status).toBe('geen');
  });

  it('controleren als signaal-huisnummer ontbreekt', () => {
    const r = beoordeelKandidaten({ adres: 'Damrak', postcode: '1012AB', plaats: 'Amsterdam' },
      [kand({ huisnummer: '1', postcode: '1012AB', woonplaats: 'Amsterdam' })]);
    expect(r.status).toBe('controleren');
  });

  it('auto wanneer top sterk overheerst over tweede', () => {
    const r = beoordeelKandidaten(inv, [
      kand({ huisnummer: '1', postcode: '1012AB', woonplaats: 'Amsterdam', score: 20 }),
      kand({ huisnummer: '1', postcode: '9999ZZ', woonplaats: 'Groningen', score: 5 }),
    ]);
    expect(r.status).toBe('auto');
  });
});
