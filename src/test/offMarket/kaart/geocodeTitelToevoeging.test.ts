import { describe, it, expect } from 'vitest';
import {
  parseAdres, combineerParsed, beoordeelKandidaten,
  type GeocodeKandidaat,
} from '@/lib/offMarket/kaart/geocode';

function k(p: Partial<GeocodeKandidaat>): GeocodeKandidaat {
  return {
    id: p.id ?? Math.random().toString(36),
    weergavenaam: p.weergavenaam ?? '',
    straat: p.straat ?? null,
    huisnummer: p.huisnummer ?? null,
    toevoeging: p.toevoeging ?? null,
    postcode: p.postcode ?? null,
    woonplaats: p.woonplaats ?? null,
    lat: p.lat ?? 51.91, lng: p.lng ?? 4.5,
    score: p.score ?? 10, type: p.type ?? 'adres',
  };
}

const TITEL =
  'Aangevraagde omgevingsvergunning, het intern verbouwen en veranderen van een appartement op de 2e en halve 4e verdieping (gemeentelijk monument), Maaskade 77A-02 3071ND Rotterdam';

describe('combineerParsed — titel-toevoeging wint van kortere adres-toevoeging', () => {
  it('adres "Maaskade 77A" + titel "...77A-02..." → toevoeging A02', () => {
    const adres = parseAdres('Maaskade 77A');
    expect(adres.toevoeging).toBe('A');
    const combined = combineerParsed(adres, TITEL);
    expect(combined.huisnummer).toBe('77');
    expect(combined.toevoeging).toBe('A02');
  });

  it('titel met losse toevoeging vult lege adres-toevoeging aan', () => {
    const adres = parseAdres('Maaskade 77');
    const combined = combineerParsed(adres, 'Maaskade 77A-02');
    expect(combined.toevoeging).toBe('A02');
  });

  it('niet-gerelateerde titel-toevoeging mag adres-toevoeging niet overschrijven', () => {
    const adres = parseAdres('Maaskade 77A');
    const combined = combineerParsed(adres, 'Maaskade 77B');
    expect(combined.toevoeging).toBe('A');
  });
});

describe('beoordeelKandidaten — Maaskade 77A met titel 77A-02', () => {
  const inv = {
    adres: 'Maaskade 77A',
    postcode: '3071ND',
    plaats: 'Rotterdam',
    titel: TITEL,
  };

  it('exacte kandidaat 77A-02 wint automatisch', () => {
    const r = beoordeelKandidaten(inv, [
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'A02', postcode: '3071ND', woonplaats: 'Rotterdam', score: 25.73 }),
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'A03', postcode: '3071ND', woonplaats: 'Rotterdam', score: 25.73 }),
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'B', postcode: '3071ND', woonplaats: 'Rotterdam', score: 22.89 }),
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'C', postcode: '3071ND', woonplaats: 'Rotterdam', score: 22.89 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') {
      expect(r.kandidaat.toevoeging).toBe('A02');
      expect(r.reden).toBe('exact_addition_match');
    }
  });

  it('alleen 77A-03 beschikbaar → controleren', () => {
    const r = beoordeelKandidaten(inv, [
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'A03', postcode: '3071ND', woonplaats: 'Rotterdam' }),
    ]);
    expect(r.status).toBe('controleren');
    if (r.status === 'controleren') expect(r.redenCode).toBe('addition_mismatch');
  });
});
