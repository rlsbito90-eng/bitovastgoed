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
  it('Nieuwe Binnenweg wint via exacte kandidaat in titel ondanks kort adresveld', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Verleende omgevingsvergunning, Nieuwe Binnenweg 256A-01 3021GP Rotterdam',
      adres: 'Binnenweg 256A',
      postcode: '3021 GP',
      plaats: 'Rotterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Nieuwe Binnenweg 256A-01, 3021GP Rotterdam', straatnaam: 'Nieuwe Binnenweg', huisnummer: '256', postcode: '3021GP', score: 26.43 }),
      pdokDoc({ weergavenaam: 'Nieuwe Binnenweg 256A-02, 3021GP Rotterdam', straatnaam: 'Nieuwe Binnenweg', huisnummer: '256', postcode: '3021GP', score: 23.49 }),
    ]), signaal_id: 'sig-nieuwe-binnenweg' });

    expect(r.status).toBe('auto');
    if (r.status === 'auto') {
      expect(r.reden).toBe('exact_text_match');
      expect(r.kandidaat.weergavenaam).toContain('256A-01');
      expect(r.kandidaat.score).toBeGreaterThanOrEqual(95);
    }
  });

  it('Govert Flinckstraat wint via exacte kandidaat in titel ondanks kort adresveld', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Aanvraag woonvormingsvergunning Govert Flinckstraat 300-2 1073CH Amsterdam',
      adres: 'Flinckstraat 300',
      postcode: '1073 CH',
      plaats: 'Amsterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Govert Flinckstraat 300-2, 1073CH Amsterdam', straatnaam: 'Govert Flinckstraat', huisnummer: '300', postcode: '1073CH', woonplaatsnaam: 'Amsterdam', score: 22.1 }),
    ]), signaal_id: 'sig-govert-flinckstraat' });

    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.reden).toBe('exact_text_match');
  });

  it('Plantage Badlaan wint via exacte kandidaat in titel ondanks kort adresveld', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Aanvraag woonvormingsvergunning Plantage Badlaan 22-H 1018TJ Amsterdam',
      adres: 'Badlaan 22',
      postcode: '1018 TJ',
      plaats: 'Amsterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Plantage Badlaan 22-H, 1018TJ Amsterdam', straatnaam: 'Plantage Badlaan', huisnummer: '22', postcode: '1018TJ', woonplaatsnaam: 'Amsterdam', score: 21.4 }),
    ]), signaal_id: 'sig-plantage-badlaan' });

    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.reden).toBe('exact_text_match');
  });

  it('Joost van Geelstraat wint via langere kandidaatstraat uit titel', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Verleende omgevingsvergunning, Joost van Geelstraat 20A 3021VM Rotterdam',
      adres: 'Geelstraat 20A',
      postcode: '3021 VM',
      plaats: 'Rotterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Joost van Geelstraat 20A, 3021VM Rotterdam', straatnaam: 'Joost van Geelstraat', huisnummer: '20', postcode: '3021VM', score: 24.6 }),
    ]), signaal_id: 'sig-joost-van-geelstraat' });

    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(['exact_text_match', 'exact_addition_match']).toContain(r.reden);
  });

  it('J. de Koostraat wint via exacte kandidaat in titel ondanks kort adresveld', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Aanvraag woonvormingsvergunning J. de Koostraat 28A 1068KR Amsterdam',
      adres: 'Koostraat 28A',
      postcode: '1068 KR',
      plaats: 'Amsterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'J. de Koostraat 28A, 1068KR Amsterdam', straatnaam: 'J. de Koostraat', huisnummer: '28', postcode: '1068KR', woonplaatsnaam: 'Amsterdam', score: 25.3 }),
    ]), signaal_id: 'sig-j-de-koostraat' });

    expect(r.status).toBe('auto');
    if (r.status === 'auto') expect(r.reden).toBe('exact_text_match');
  });

  it('Tollensstraat met twee adressen wordt multiple-adres en niet straatnaam wijkt af', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Aangevraagde omgevingsvergunning, Tollensstraat 67A-1 3035ND Rotterdam, Tollensstraat 67A-2 3035ND Rotterdam',
      adres: 'Tollensstraat 67A',
      postcode: '3035 ND',
      plaats: 'Rotterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Tollensstraat 67A-01, 3035ND Rotterdam', straatnaam: 'Tollensstraat', huisnummer: '67', postcode: '3035ND', score: 26.1 }),
      pdokDoc({ weergavenaam: 'Tollensstraat 67A-02, 3035ND Rotterdam', straatnaam: 'Tollensstraat', huisnummer: '67', postcode: '3035ND', score: 25.9 }),
    ]), signaal_id: 'sig-tollensstraat' });

    expect(r.status).toBe('controleren');
    if (r.status === 'controleren') {
      expect(r.redenCode).toBe('multiple_addresses');
      expect(r.reden).toBe('Meerdere adressen gevonden.');
      expect(r.reden).not.toBe('Straatnaam wijkt af.');
    }
  });

  it('Valeriusstraat 91 zonder toevoeging blijft terecht handmatig', async () => {
    const r = await geocodeSignaalLocatie({
      titel: 'Aanvraag woonvormingsvergunning Valeriusstraat 91 1075EP Amsterdam',
      adres: 'Valeriusstraat 91',
      postcode: '1075 EP',
      plaats: 'Amsterdam',
    }, { fetchImpl: fetchMetDocs([
      pdokDoc({ weergavenaam: 'Valeriusstraat 91-H, 1075EP Amsterdam', straatnaam: 'Valeriusstraat', huisnummer: '91', postcode: '1075EP', woonplaatsnaam: 'Amsterdam', score: 21.75 }),
      pdokDoc({ weergavenaam: 'Valeriusstraat 91A, 1075EP Amsterdam', straatnaam: 'Valeriusstraat', huisnummer: '91', postcode: '1075EP', woonplaatsnaam: 'Amsterdam', score: 21.75 }),
      pdokDoc({ weergavenaam: 'Valeriusstraat 91-1, 1075EP Amsterdam', straatnaam: 'Valeriusstraat', huisnummer: '91', postcode: '1075EP', woonplaatsnaam: 'Amsterdam', score: 21.39 }),
      pdokDoc({ weergavenaam: 'Valeriusstraat 91-2, 1075EP Amsterdam', straatnaam: 'Valeriusstraat', huisnummer: '91', postcode: '1075EP', woonplaatsnaam: 'Amsterdam', score: 21.39 }),
    ]), signaal_id: 'sig-valeriusstraat' });

    expect(r.status).toBe('controleren');
    if (r.status === 'controleren') {
      expect(r.redenCode).toBe('multiple_additions');
      expect(r.reden).toBe('Meerdere toevoegingen gevonden bij dit huisnummer.');
    }
  });

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