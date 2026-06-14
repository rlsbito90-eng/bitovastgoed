import { describe, it, expect } from 'vitest';
import {
  parseAdres, beoordeelKandidaten,
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

describe('parseAdres — toevoegingen met streep', () => {
  it('Maaskade 77A-02 → huisnummer 77, toevoeging A02', () => {
    expect(parseAdres('Maaskade 77A-02')).toEqual({
      straat: 'Maaskade', huisnummer: '77', toevoeging: 'A02',
    });
  });
  it('Maaskade 77B → huisnummer 77, toevoeging B', () => {
    expect(parseAdres('Maaskade 77B')).toEqual({
      straat: 'Maaskade', huisnummer: '77', toevoeging: 'B',
    });
  });
  it('Van Spilbergenstraat 9-H → toevoeging H', () => {
    expect(parseAdres('Van Spilbergenstraat 9-H')).toEqual({
      straat: 'Van Spilbergenstraat', huisnummer: '9', toevoeging: 'H',
    });
  });
  it('strippen trailing postcode + plaats uit adresregel', () => {
    expect(parseAdres('Maaskade 77A-02 3071ND Rotterdam')).toEqual({
      straat: 'Maaskade', huisnummer: '77', toevoeging: 'A02',
    });
    expect(parseAdres('Maaskade 77A-02 3071 ND Rotterdam')).toEqual({
      straat: 'Maaskade', huisnummer: '77', toevoeging: 'A02',
    });
  });
});

describe('beoordeelKandidaten — Maaskade 77A-02 (Rotterdam)', () => {
  const inv = { adres: 'Maaskade 77A-02', postcode: '3071ND', plaats: 'Rotterdam' };

  it('exacte toevoeging wint van 77A-03 en 77B', () => {
    const r = beoordeelKandidaten(inv, [
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'A02', postcode: '3071ND', woonplaats: 'Rotterdam', score: 12 }),
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'A03', postcode: '3071ND', woonplaats: 'Rotterdam', score: 14 }),
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'B', postcode: '3071ND', woonplaats: 'Rotterdam', score: 10 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') {
      expect(r.kandidaat.toevoeging).toBe('A02');
      expect(r.reden).toBe('exact_addition_match');
    }
  });

  it('alleen 77A-03 beschikbaar → controleren (toevoeging wijkt af)', () => {
    const r = beoordeelKandidaten(inv, [
      k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'A03', postcode: '3071ND', woonplaats: 'Rotterdam' }),
    ]);
    expect(r.status).toBe('controleren');
    if (r.status === 'controleren') expect(r.redenCode).toBe('addition_mismatch');
  });

  it('postcode met spatie in PDOK-kandidaat geldt als gelijk', () => {
    // Kandidaat genormaliseerd opgeslagen zonder spatie; we testen via input mét spatie
    const r = beoordeelKandidaten(
      { adres: 'Maaskade 77A-02', postcode: '3071 ND', plaats: 'Rotterdam' },
      [k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'A02', postcode: '3071ND', woonplaats: 'Rotterdam' })],
    );
    expect(r.status).toBe('auto');
  });
});

describe('beoordeelKandidaten — overige patronen', () => {
  it('Maaskade 77B → automatische match', () => {
    const r = beoordeelKandidaten(
      { adres: 'Maaskade 77B', postcode: '3071ND', plaats: 'Rotterdam' },
      [k({ straat: 'Maaskade', huisnummer: '77', toevoeging: 'B', postcode: '3071ND', woonplaats: 'Rotterdam' })],
    );
    expect(r.status).toBe('auto');
  });

  it('Van Spilbergenstraat 9-H → automatische match op H', () => {
    const r = beoordeelKandidaten(
      { adres: 'Van Spilbergenstraat 9-H', postcode: '1057PV', plaats: 'Amsterdam' },
      [
        k({ straat: 'Van Spilbergenstraat', huisnummer: '9', toevoeging: 'H', postcode: '1057PV', woonplaats: 'Amsterdam' }),
        k({ straat: 'Van Spilbergenstraat', huisnummer: '9', toevoeging: '1', postcode: '1057PV', woonplaats: 'Amsterdam' }),
        k({ straat: 'Van Spilbergenstraat', huisnummer: '9', toevoeging: '2', postcode: '1057PV', woonplaats: 'Amsterdam' }),
      ],
    );
    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.kandidaat.toevoeging).toBe('H');
  });
});
