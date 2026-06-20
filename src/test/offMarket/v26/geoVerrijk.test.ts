// V2.6 — Server-side adresgeocoding (PDOK free) voor Off-Market Radar.
// Pure-function tests: parser, query-bouw, centroide parsing en kandidaatselectie.
import { describe, it, expect } from 'vitest';
import {
  bouwQuery,
  parseCentroideLL,
  kiesKandidaat,
  ensureCoords,
  GEO_TRIGGER_CAP_PER_RUN,
  NL_BOUNDS,
  type PdokDoc,
} from '../../../../supabase/functions/_shared/offMarketGeocode';

function doc(over: Partial<PdokDoc>): PdokDoc {
  return {
    id: 'pdok-1',
    type: 'adres',
    score: 10,
    weergavenaam: 'Voorbeeldstraat 12, 1000 AA Teststad',
    straatnaam: 'Voorbeeldstraat',
    huisnummer: 12,
    postcode: '1000 AA',
    woonplaatsnaam: 'Teststad',
    centroide_ll: 'POINT(4.900000 52.370000)',
    ...over,
  };
}

describe('parseCentroideLL — POINT(lng lat) volgorde', () => {
  it('lng staat eerst, lat tweede; geen omwisseling', () => {
    const r = parseCentroideLL('POINT(4.9 52.37)');
    expect(r).not.toBeNull();
    expect(r!.lng).toBe(4.9);
    expect(r!.lat).toBe(52.37);
  });

  it('weigert coördinaten buiten Nederland', () => {
    expect(parseCentroideLL('POINT(2.35 48.85)')).toBeNull(); // Parijs
    expect(parseCentroideLL('POINT(13.4 52.5)')).toBeNull(); // Berlijn
  });

  it('accepteert randen van NL-bounds', () => {
    expect(parseCentroideLL(`POINT(${NL_BOUNDS.lngMin} ${NL_BOUNDS.latMin})`)).not.toBeNull();
    expect(parseCentroideLL(`POINT(${NL_BOUNDS.lngMax} ${NL_BOUNDS.latMax})`)).not.toBeNull();
  });

  it('retourneert null voor onbruikbare input', () => {
    expect(parseCentroideLL(null)).toBeNull();
    expect(parseCentroideLL('')).toBeNull();
    expect(parseCentroideLL('niet een point')).toBeNull();
  });
});

describe('bouwQuery', () => {
  it('combineert postcode, straat, huisnummer en plaats', () => {
    const q = bouwQuery({ adres: 'Voorbeeldstraat 12', postcode: '1000AA', plaats: 'Teststad' });
    expect(q).toBe('1000 AA Voorbeeldstraat 12 Teststad');
  });

  it('werkt met alleen postcode + huisnummer', () => {
    const q = bouwQuery({ adres: 'Straat 5', postcode: '2000 BB', plaats: null });
    expect(q).toMatch(/2000 BB/);
    expect(q).toMatch(/ 5/);
  });

  it('werkt met alleen straat + huisnummer + plaats (geen postcode)', () => {
    const q = bouwQuery({ adres: 'Straat 5', postcode: null, plaats: 'Plaatsstad' });
    expect(q).toBe('Straat 5 Plaatsstad');
  });

  it('retourneert null zonder huisnummer of zonder pc/plaats', () => {
    expect(bouwQuery({ adres: 'Alleen straatnaam', postcode: null, plaats: 'Plaats' })).toBeNull();
    expect(bouwQuery({ adres: 'Straat 5', postcode: null, plaats: null })).toBeNull();
    expect(bouwQuery({ adres: null, postcode: null, plaats: 'Plaats' })).toBeNull();
  });
});

describe('kiesKandidaat — strikte acceptatieregels', () => {
  const inv = { adres: 'Voorbeeldstraat 12', postcode: '1000 AA', plaats: 'Teststad' };

  it('accepteert exacte postcode-match met type=adres', () => {
    const r = kiesKandidaat(inv, [doc({})]);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.match.reden).toBe('postcode_exact');
      expect(r.match.lat).toBe(52.37);
      expect(r.match.lng).toBe(4.9);
    }
  });

  it('weigert afwijkende postcode bij overigens correct adres', () => {
    const r = kiesKandidaat(inv, [doc({ postcode: '9999 ZZ' })]);
    expect(r.status).toBe('geen_match');
  });

  it('weigert woonplaats-/gemeente-/wijk-/buurtcentroïde', () => {
    for (const t of ['woonplaats', 'gemeente', 'wijk', 'buurt']) {
      const r = kiesKandidaat(inv, [doc({ type: t })]);
      expect(r.status).toBe('geen_match');
    }
  });

  it('zonder postcode: eist exacte straat + huisnummer + plaats', () => {
    const invZP = { adres: 'Voorbeeldstraat 12', postcode: null, plaats: 'Teststad' };
    // Match
    const ok = kiesKandidaat(invZP, [doc({ postcode: null })]);
    expect(ok.status).toBe('ok');
    if (ok.status === 'ok') expect(ok.match.reden).toBe('adres_exact');
    // Afwijkende straat → geen match
    const fout1 = kiesKandidaat(invZP, [doc({ postcode: null, straatnaam: 'Anderestraat' })]);
    expect(fout1.status).toBe('geen_match');
    // Afwijkende plaats → geen match
    const fout2 = kiesKandidaat(invZP, [doc({ postcode: null, woonplaatsnaam: 'Anderstad' })]);
    expect(fout2.status).toBe('geen_match');
    // Afwijkend huisnummer → geen match
    const fout3 = kiesKandidaat(invZP, [doc({ postcode: null, huisnummer: 14 })]);
    expect(fout3.status).toBe('geen_match');
  });

  it('zonder huisnummer in input → geen_adres', () => {
    const r = kiesKandidaat({ adres: 'Voorbeeldstraat', postcode: '1000 AA', plaats: 'Teststad' }, [doc({})]);
    expect(r.status).toBe('geen_adres');
  });

  it('zonder pc én plaats → geen_adres', () => {
    const r = kiesKandidaat({ adres: 'Straat 12', postcode: null, plaats: null }, [doc({})]);
    expect(r.status).toBe('geen_adres');
  });

  it('weigert kandidaat met centroïde buiten Nederland', () => {
    const r = kiesKandidaat(inv, [doc({ centroide_ll: 'POINT(2.35 48.85)' })]);
    expect(r.status).toBe('geen_match');
  });

  it('kiest correcte kandidaat uit mix met centroïden', () => {
    const r = kiesKandidaat(inv, [
      doc({ type: 'gemeente', weergavenaam: 'Gemeente Teststad' }),
      doc({ type: 'woonplaats', weergavenaam: 'Teststad' }),
      doc({}),
    ]);
    expect(r.status).toBe('ok');
  });
});

describe('ensureCoords — single-call end-to-end via mock fetch', () => {
  const inv = { adres: 'Voorbeeldstraat 12', postcode: '1000 AA', plaats: 'Teststad' };

  function mockFetch(docs: PdokDoc[]): typeof fetch {
    return (async (_url: string) =>
      new Response(JSON.stringify({ response: { docs } }), { status: 200 })) as unknown as typeof fetch;
  }

  it('returnt ok bij geldige kandidaat', async () => {
    const r = await ensureCoords(inv, { fetchImpl: mockFetch([doc({})]) });
    expect(r.status).toBe('ok');
  });

  it('returnt geen_adres zonder bruikbare input', async () => {
    const r = await ensureCoords({ adres: null, postcode: null, plaats: null }, { fetchImpl: mockFetch([]) });
    expect(r.status).toBe('geen_adres');
  });

  it('returnt geen_match als PDOK geen passende kandidaat oplevert', async () => {
    const r = await ensureCoords(inv, { fetchImpl: mockFetch([doc({ postcode: '9999 ZZ' })]) });
    expect(r.status).toBe('geen_match');
  });
});

describe('GEO trigger cap', () => {
  it('is 25 per normalize-run', () => {
    expect(GEO_TRIGGER_CAP_PER_RUN).toBe(25);
  });
});
