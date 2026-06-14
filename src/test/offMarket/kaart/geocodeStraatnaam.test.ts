import { describe, it, expect } from 'vitest';
import {
  combineerParsed, parseAdres, beoordeelKandidaten,
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
    lat: p.lat ?? 51.9, lng: p.lng ?? 4.5,
    score: p.score ?? 12, type: p.type ?? 'adres',
  };
}

describe('combineerParsed — titel mag straat niet vervuilen met niet-straat-woorden', () => {
  it('"Vergunning kamerverhuur IJsselmondselaan 290A" laat adres-straat ongewijzigd', () => {
    const adres = parseAdres('IJsselmondselaan 290A');
    const c = combineerParsed(adres, 'Vergunning kamerverhuur IJsselmondselaan 290A');
    expect(c.straat).toBe('IJsselmondselaan');
    expect(c.huisnummer).toBe('290');
    expect(c.toevoeging).toBe('A');
  });

  it('"Derde Schinkelstraat 20" mag wel verlengen vanaf "Schinkelstraat"', () => {
    const adres = parseAdres('Schinkelstraat 20');
    const c = combineerParsed(adres, 'Aanvraag Derde Schinkelstraat 20');
    // "Aanvraag Derde Schinkelstraat" eindigt op "Schinkelstraat" maar "Aanvraag Derde" is geen geldige prefix → blijft ongewijzigd
    expect(c.straat).toBe('Schinkelstraat');
  });

  it('titel "Derde Schinkelstraat 20" zonder ruis verlengt wel', () => {
    const adres = parseAdres('Schinkelstraat 20');
    const c = combineerParsed(adres, 'Derde Schinkelstraat 20');
    expect(c.straat).toBe('Derde Schinkelstraat');
  });

  it('"Van Spilbergenstraat" verlengt vanaf "Spilbergenstraat"', () => {
    const adres = parseAdres('Spilbergenstraat 9');
    const c = combineerParsed(adres, 'Van Spilbergenstraat 9');
    expect(c.straat).toBe('Van Spilbergenstraat');
  });
});

describe('beoordeelKandidaten — IJsselmondselaan 290A', () => {
  const inv = {
    adres: 'IJsselmondselaan 290A',
    postcode: null,
    plaats: 'Rotterdam',
    titel: 'Vergunning kamerverhuur IJsselmondselaan 290A',
  };

  it('automatisch gematcht op straat + huisnummer + toevoeging + plaats (postcode ontbreekt)', () => {
    const r = beoordeelKandidaten(inv, [
      k({ straat: 'IJsselmondselaan', huisnummer: '290', toevoeging: 'A', postcode: '3064AV', woonplaats: 'Rotterdam', score: 18.16 }),
      k({ straat: 'IJsselmondselaan', huisnummer: '290', toevoeging: 'B', postcode: '3064AV', woonplaats: 'Rotterdam', score: 16.38 }),
      k({ straat: 'IJsselmondselaan', huisnummer: '179', toevoeging: 'A', postcode: '3064AS', woonplaats: 'Rotterdam', score: 13.3 }),
    ]);
    expect(r.status).toBe('auto');
    if (r.status === 'auto') {
      expect(r.kandidaat.toevoeging).toBe('A');
      expect(r.kandidaat.huisnummer).toBe('290');
    }
  });

  it('OCR-variant "lJsselmondselaan" (kleine L) matcht ook automatisch', () => {
    const r = beoordeelKandidaten(
      { adres: 'lJsselmondselaan 290A', postcode: null, plaats: 'Rotterdam', titel: null },
      [k({ straat: 'IJsselmondselaan', huisnummer: '290', toevoeging: 'A', postcode: '3064AV', woonplaats: 'Rotterdam' })],
    );
    expect(r.status).toBe('auto');
  });
});
