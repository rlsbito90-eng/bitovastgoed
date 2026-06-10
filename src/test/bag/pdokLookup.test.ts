import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  normaliseerPostcodeStrikt, bouwZoekQuery, zoekBagAdressen,
} from '@/lib/bag/pdokLookup';

describe('normaliseerPostcodeStrikt', () => {
  it('verwijdert spatie en zet hoofdletters', () => {
    expect(normaliseerPostcodeStrikt('3273 av')).toBe('3273AV');
    expect(normaliseerPostcodeStrikt('3273av')).toBe('3273AV');
  });
  it('geeft null bij ongeldig', () => {
    expect(normaliseerPostcodeStrikt('abc')).toBeNull();
    expect(normaliseerPostcodeStrikt(null)).toBeNull();
    expect(normaliseerPostcodeStrikt('327 AV')).toBeNull();
  });
});

describe('bouwZoekQuery', () => {
  it('combineert straat + huisnummer + plaats', () => {
    expect(bouwZoekQuery({ straat: 'Damrak', huisnummer: '1', plaats: 'Amsterdam' }))
      .toBe('Damrak 1 Amsterdam');
  });
  it('zet postcode vooraan met spatie', () => {
    expect(bouwZoekQuery({ postcode: '3273av', huisnummer: '30' }))
      .toBe('3273 AV 30');
  });
});

describe('zoekBagAdressen', () => {
  const origFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = origFetch; });

  it('roept PDOK aan en mapt resultaten', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({
      response: {
        docs: [{
          id: 'adr-1', weergavenaam: 'Prins Willem Alexanderlaan 30, 3273AV Westmaas',
          straatnaam: 'Prins Willem Alexanderlaan', huisnummer: 30,
          postcode: '3273AV', woonplaatsnaam: 'Westmaas',
          nummeraanduiding_id: '0000200000000001',
        }],
      },
    }), { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const r = await zoekBagAdressen({ straat: 'Prins Willem Alexanderlaan', huisnummer: '30', plaats: 'Westmaas' });
    expect(r).toHaveLength(1);
    expect(r[0].postcode).toBe('3273AV');
    expect(r[0].huisnummer).toBe('30');
    expect(r[0].nummeraanduiding_id).toBe('0000200000000001');

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toContain('api.pdok.nl');
    expect(calledUrl).toContain('fq=type%3Aadres');
  });

  it('geeft lege array bij lege query (geen call)', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const r = await zoekBagAdressen({});
    expect(r).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
