import { describe, it, expect } from 'vitest';
import {
  parseAdres, bouwQuery, beoordeelKandidaten,
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
});

describe('exacte toevoeging-match', () => {
  const invA = { adres: 'Muiderslaan 405A', postcode: '1087VA', plaats: 'Amsterdam' };

  it('405A → auto bij exact één match met toevoeging A tussen meerdere', () => {
    const r = beoordeelKandidaten(invA, [
      kand({ huisnummer: '405', toevoeging: 'A', postcode: '1087VA', woonplaats: 'Amsterdam', score: 9 }),
      kand({ huisnummer: '405', toevoeging: 'B', postcode: '1087VA', woonplaats: 'Amsterdam', score: 9 }),
      kand({ huisnummer: '405', toevoeging: 'C', postcode: '1087VA', woonplaats: 'Amsterdam', score: 9 }),
      kand({ huisnummer: '405', toevoeging: 'D', postcode: '1087VA', woonplaats: 'Amsterdam', score: 9 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.kandidaat.toevoeging).toBe('A');
  });

  it('405-A normaliseert en matcht met 405 A', () => {
    const r = beoordeelKandidaten(
      { adres: 'Muiderslaan 405-A', postcode: '1087VA', plaats: 'Amsterdam' },
      [
        kand({ huisnummer: '405', toevoeging: 'A', postcode: '1087VA' }),
        kand({ huisnummer: '405', toevoeging: 'B', postcode: '1087VA' }),
      ],
    );
    expect(r.status).toBe('auto');
  });

  it('12-2 matcht met 12 2', () => {
    const r = beoordeelKandidaten(
      { adres: 'Foo 12-2', postcode: '1000AA', plaats: 'X' },
      [
        kand({ huisnummer: '12', toevoeging: '1', postcode: '1000AA' }),
        kand({ huisnummer: '12', toevoeging: '2', postcode: '1000AA' }),
      ],
    );
    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.kandidaat.toevoeging).toBe('2');
  });

  it('405A kiest niet 405B als enige kandidaat', () => {
    const r = beoordeelKandidaten(invA, [
      kand({ huisnummer: '405', toevoeging: 'B', postcode: '1087VA', woonplaats: 'Amsterdam' }),
    ]);
    expect(r.status).toBe('controleren');
  });

  it('input zonder toevoeging blijft controleren bij meerdere toevoegingen', () => {
    const r = beoordeelKandidaten(
      { adres: 'Muiderslaan 405', postcode: '1087VA', plaats: 'Amsterdam' },
      [
        kand({ huisnummer: '405', toevoeging: 'A', postcode: '1087VA' }),
        kand({ huisnummer: '405', toevoeging: 'B', postcode: '1087VA' }),
      ],
    );
    expect(r.status).toBe('controleren');
  });

  it('exacte toevoeging wint van hogere score met verkeerde toevoeging', () => {
    const r = beoordeelKandidaten(invA, [
      kand({ huisnummer: '405', toevoeging: 'B', postcode: '1087VA', score: 99 }),
      kand({ huisnummer: '405', toevoeging: 'A', postcode: '1087VA', score: 5 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.kandidaat.toevoeging).toBe('A');
  });

  it('afwijkende postcode blijft controleren', () => {
    const r = beoordeelKandidaten(invA, [
      kand({ huisnummer: '405', toevoeging: 'A', postcode: '9999ZZ', woonplaats: 'Groningen' }),
    ]);
    expect(r.status).toBe('controleren');
  });

  it('12-2 kiest niet 12-1', () => {
    const r = beoordeelKandidaten(
      { adres: 'Foo 12-2', postcode: '1000AA', plaats: 'X' },
      [kand({ huisnummer: '12', toevoeging: '1', postcode: '1000AA' })],
    );
    expect(r.status).toBe('controleren');
  });
});
