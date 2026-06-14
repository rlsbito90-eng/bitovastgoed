import { describe, it, expect, vi } from 'vitest';
import { geocodeSignaalLocatie, combineerParsed, parseAdres } from '@/lib/offMarket/kaart/geocode';

function pdokDoc(p: {
  weergavenaam: string;
  straatnaam: string;
  huisnummer: string;
  postcode?: string;
  woonplaatsnaam?: string;
  score?: number;
}) {
  return {
    id: p.weergavenaam,
    type: 'adres',
    score: p.score ?? 12,
    weergavenaam: p.weergavenaam,
    straatnaam: p.straatnaam,
    huisnummer: p.huisnummer,
    postcode: p.postcode ?? '3071ND',
    woonplaatsnaam: p.woonplaatsnaam ?? 'Rotterdam',
    centroide_ll: 'POINT(4.5 51.91)',
  };
}

function fetchMetDocs(docs: unknown[]) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ response: { docs } }) })) as unknown as typeof fetch;
}

describe('geocodeSignaalLocatie — runtime-flow kaart', () => {
  it('titel-adres Maaskade 77A-02 wint van adresveld Maaskade 77A', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Aangevraagde omgevingsvergunning, het intern verbouwen en veranderen van een appartement op de 2e en halve 4e verdieping (gemeentelijk monument), Maaskade 77A-02 3071ND Rotterdam',
      adres: 'Maaskade 77A',
      postcode: '3071 ND',
      plaats: 'Rotterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Maaskade 77A-02, 3071ND Rotterdam', straatnaam: 'Maaskade', huisnummer: '77', score: 27.08 }),
      pdokDoc({ weergavenaam: 'Maaskade 77A-03, 3071ND Rotterdam', straatnaam: 'Maaskade', huisnummer: '77', score: 24.01 }),
      pdokDoc({ weergavenaam: 'Maaskade 77B, 3071ND Rotterdam', straatnaam: 'Maaskade', huisnummer: '77', score: 22.89 }),
    ]), signaal_id: 'sig-maaskade' });

    expect(r.status).toBe('auto');
    if (r.status === 'auto') {
      expect(r.reden).toBe('exact_text_match');
      expect(r.kandidaat.weergavenaam).toContain('77A-02');
      expect(r.kandidaat.score).toBeGreaterThanOrEqual(95);
    }
    expect(r.debug?.geparseerde_huisletter).toBe('A');
    expect(r.debug?.geparseerde_toevoeging).toBe('02');
  });

  it('Godijn van Dormaalstraat blijft volledig en matcht automatisch', async () => {
    const parsed = combineerParsed(parseAdres('Dormaalstraat 21'), 'Vergunning kamerverhuur Godijn van Dormaalstraat 21');
    expect(parsed.straat).toBe('Godijn van Dormaalstraat');

    const r = await geocodeSignaalLocatie({
      titel: 'Vergunning kamerverhuur Godijn van Dormaalstraat 21',
      adres: 'Dormaalstraat 21',
      postcode: null,
      plaats: 'Rotterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Godijn van Dormaalstraat 21, 3067JG Rotterdam', straatnaam: 'Godijn van Dormaalstraat', huisnummer: '21', postcode: '3067JG', score: 13.52 }),
      pdokDoc({ weergavenaam: 'van Dormaalstraat 21, 5624KH Eindhoven', straatnaam: 'van Dormaalstraat', huisnummer: '21', postcode: '5624KH', woonplaatsnaam: 'Eindhoven', score: 11.52 }),
    ]), signaal_id: 'sig-godijn' });

    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.reden).toBe('exact_text_match');
    expect(r.debug?.geparseerde_straat).toBe('Godijn van Dormaalstraat');
  });

  it('echte toevoegingsmismatch blijft handmatig', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Vergunning onbekend Maaskade 77A-04',
      adres: 'Maaskade 77A-04',
      postcode: '3071ND',
      plaats: 'Rotterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Maaskade 77A-02, 3071ND Rotterdam', straatnaam: 'Maaskade', huisnummer: '77' }),
      pdokDoc({ weergavenaam: 'Maaskade 77A-03, 3071ND Rotterdam', straatnaam: 'Maaskade', huisnummer: '77' }),
    ]) });

    expect(r.status).toBe('controleren');
  });
});