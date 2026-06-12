import { describe, it, expect } from 'vitest';
import {
  parseAdres, bouwQuery, beoordeelKandidaten, redenLabel,
  type GeocodeKandidaat,
} from '@/lib/offMarket/kaart/geocode';

describe('parseAdres', () => {
  it('parseert straat + huisnummer', () => {
    expect(parseAdres('Sarphatistraat 90')).toEqual({ straat: 'Sarphatistraat', huisnummer: '90', toevoeging: null });
  });
  it('parseert huisletter direct aan nummer', () => {
    expect(parseAdres('Muiderslaan 405A')).toEqual({ straat: 'Muiderslaan', huisnummer: '405', toevoeging: 'A' });
  });
  it('parseert huisletter met spatie', () => {
    expect(parseAdres('Damrak 1 A')).toEqual({ straat: 'Damrak', huisnummer: '1', toevoeging: 'A' });
  });
  it('parseert huisletter met streep', () => {
    expect(parseAdres('Damrak 1-A')).toEqual({ straat: 'Damrak', huisnummer: '1', toevoeging: 'A' });
  });
  it('parseert toevoeging na streep', () => {
    expect(parseAdres('Sarphatipark 86-2')).toEqual({ straat: 'Sarphatipark', huisnummer: '86', toevoeging: '2' });
  });
  it('parseert toevoeging met spatie', () => {
    expect(parseAdres('Sarphatipark 12 2')).toEqual({ straat: 'Sarphatipark', huisnummer: '12', toevoeging: '2' });
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
    id: p.id ?? Math.random().toString(36), weergavenaam: p.weergavenaam ?? '',
    straat: p.straat ?? null, huisnummer: p.huisnummer ?? null,
    toevoeging: p.toevoeging ?? null,
    postcode: p.postcode ?? null, woonplaats: p.woonplaats ?? null,
    lat: p.lat ?? 52.37, lng: p.lng ?? 4.9, score: p.score ?? 10, type: p.type ?? 'adres',
  };
}

describe('beoordeelKandidaten — basis', () => {
  const inv = { adres: 'Damrak 1', postcode: '1012AB', plaats: 'Amsterdam' };

  it('auto: enige kandidaat, huisnummer + postcode + straat match', () => {
    const r = beoordeelKandidaten(inv, [kand({ straat: 'Damrak', huisnummer: '1', postcode: '1012AB', woonplaats: 'Amsterdam' })]);
    expect(r.status).toBe('auto');
  });

  it('controleren bij afwijkend huisnummer', () => {
    const r = beoordeelKandidaten(inv, [kand({ straat: 'Damrak', huisnummer: '5', postcode: '1012AB', woonplaats: 'Amsterdam' })]);
    expect(r.status).toBe('controleren');
  });

  it('controleren bij postcode en plaats mismatch', () => {
    const r = beoordeelKandidaten(inv, [kand({ straat: 'Damrak', huisnummer: '1', postcode: '9999ZZ', woonplaats: 'Groningen' })]);
    expect(r.status).toBe('controleren');
  });

  it('controleren bij straat mismatch', () => {
    const r = beoordeelKandidaten(inv, [kand({ straat: 'Rokin', huisnummer: '1', postcode: '1012AB', woonplaats: 'Amsterdam' })]);
    expect(r.status).toBe('controleren');
    if (r.status === 'controleren') expect(r.redenCode).toBe('street_mismatch');
  });

  it('geen bij lege lijst', () => {
    const r = beoordeelKandidaten(inv, []);
    expect(r.status).toBe('geen');
  });
});

describe('beoordeelKandidaten — toevoeging', () => {
  const invA = { adres: 'Muiderslaan 405A', postcode: '1087VA', plaats: 'Amsterdam' };

  it('405A → auto bij exact één match met toevoeging A tussen meerdere', () => {
    const r = beoordeelKandidaten(invA, [
      kand({ straat: 'Muiderslaan', huisnummer: '405', toevoeging: 'A', postcode: '1087VA', woonplaats: 'Amsterdam' }),
      kand({ straat: 'Muiderslaan', huisnummer: '405', toevoeging: 'B', postcode: '1087VA', woonplaats: 'Amsterdam' }),
      kand({ straat: 'Muiderslaan', huisnummer: '405', toevoeging: 'C', postcode: '1087VA', woonplaats: 'Amsterdam' }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.kandidaat.toevoeging).toBe('A');
  });

  it('405A kiest niet 405B als enige kandidaat', () => {
    const r = beoordeelKandidaten(invA, [
      kand({ straat: 'Muiderslaan', huisnummer: '405', toevoeging: 'B', postcode: '1087VA' }),
    ]);
    expect(r.status).toBe('controleren');
  });

  it('exacte toevoeging wint van hogere score met verkeerde toevoeging', () => {
    const r = beoordeelKandidaten(invA, [
      kand({ straat: 'Muiderslaan', huisnummer: '405', toevoeging: 'B', postcode: '1087VA', score: 99 }),
      kand({ straat: 'Muiderslaan', huisnummer: '405', toevoeging: 'A', postcode: '1087VA', score: 5 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.kandidaat.toevoeging).toBe('A');
  });
});

describe('beoordeelKandidaten — basisadres uniek (nieuwe regel)', () => {
  it('Jan Luijkenstraat 16 → auto wanneer basisadres "16" zonder toevoeging uniek voorkomt naast subadressen', () => {
    const inv = { adres: 'Jan Luijkenstraat 16', postcode: '1071CN', plaats: 'Amsterdam' };
    const r = beoordeelKandidaten(inv, [
      kand({ straat: 'Jan Luijkenstraat', huisnummer: '16', toevoeging: null, postcode: '1071CN', woonplaats: 'Amsterdam', score: 12 }),
      kand({ straat: 'Jan Luijkenstraat', huisnummer: '16', toevoeging: '1', postcode: '1071CN', woonplaats: 'Amsterdam', score: 11 }),
      kand({ straat: 'Jan Luijkenstraat', huisnummer: '16', toevoeging: '2', postcode: '1071CN', woonplaats: 'Amsterdam', score: 10 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') {
      expect(r.kandidaat.toevoeging).toBeNull();
      expect(r.reden).toBe('basic_address_unique');
    }
  });

  it('Nicolaas Berchemstraat 4 zonder basisadres-resultaat → controleren (alleen subadressen)', () => {
    const inv = { adres: 'Nicolaas Berchemstraat 4', postcode: '1073VR', plaats: 'Amsterdam' };
    const r = beoordeelKandidaten(inv, [
      kand({ straat: 'Nicolaas Berchemstraat', huisnummer: '4', toevoeging: 'H', postcode: '1073VR', score: 12 }),
      kand({ straat: 'Nicolaas Berchemstraat', huisnummer: '4', toevoeging: '1', postcode: '1073VR', score: 11 }),
      kand({ straat: 'Nicolaas Berchemstraat', huisnummer: '4', toevoeging: '2', postcode: '1073VR', score: 10 }),
    ]);
    expect(r.status).toBe('controleren');
    if (r.status === 'controleren') expect(r.redenCode).toBe('multiple_additions');
  });

  it('Rijnstraat 101-2 → auto via exact toevoeging-match', () => {
    const inv = { adres: 'Rijnstraat 101-2', postcode: '1079HA', plaats: 'Amsterdam' };
    const r = beoordeelKandidaten(inv, [
      kand({ straat: 'Rijnstraat', huisnummer: '101', toevoeging: '1', postcode: '1079HA', score: 11 }),
      kand({ straat: 'Rijnstraat', huisnummer: '101', toevoeging: '2', postcode: '1079HA', score: 12 }),
      kand({ straat: 'Rijnstraat', huisnummer: '101', toevoeging: '3', postcode: '1079HA', score: 10 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.kandidaat.toevoeging).toBe('2');
  });
});

describe('redenLabel', () => {
  it('vertaalt naar NL', () => {
    expect(redenLabel('multiple_additions')).toContain('toevoeging');
    expect(redenLabel('postcode_mismatch')).toContain('Postcode');
  });
});
