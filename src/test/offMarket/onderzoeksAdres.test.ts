import { describe, it, expect } from 'vitest';
import {
  bouwOnderzoeksAdresQuery,
  bouwGoogleMapsUrl,
  bouwGoogleSearchUrl,
  schoonAdresTekst,
} from '@/lib/offMarket/onderzoeksAdres';

describe('bouwOnderzoeksAdresQuery', () => {
  it('verwijdert "Aanvraag" uit het adres', () => {
    const q = bouwOnderzoeksAdresQuery({
      adres: 'Marco Polostraat 251-H Aanvraag',
      postcode: null,
      plaats: 'Amsterdam',
    });
    expect(q).toBe('Marco Polostraat 251-H Amsterdam');
  });

  it('behoudt volledige toevoeging Nieuwe Binnenweg 256A-01', () => {
    const q = bouwOnderzoeksAdresQuery({
      adres: 'Nieuwe Binnenweg 256A-01',
      postcode: '3021 GP',
      plaats: 'Rotterdam',
    });
    expect(q).toBe('Nieuwe Binnenweg 256A-01 3021 GP Rotterdam');
  });

  it('behoudt Maaskade 77A-02 met postcode', () => {
    const q = bouwOnderzoeksAdresQuery({
      adres: 'Maaskade 77A-02',
      postcode: '3071 ND',
      plaats: 'Rotterdam',
    });
    expect(q).toBe('Maaskade 77A-02 3071 ND Rotterdam');
  });

  it('behoudt Stuyvesantstraat 35-H Amsterdam', () => {
    const q = bouwOnderzoeksAdresQuery({
      adres: 'Stuyvesantstraat 35-H',
      postcode: null,
      plaats: 'Amsterdam',
    });
    expect(q).toBe('Stuyvesantstraat 35-H Amsterdam');
  });

  it('verwijdert vergunningswoorden', () => {
    const q = bouwOnderzoeksAdresQuery({
      adres: 'Verleende omgevingsvergunning Prinsengracht 263A',
      postcode: null,
      plaats: 'Amsterdam',
    });
    expect(q).toBe('Prinsengracht 263A Amsterdam');
  });

  it('retourneert null bij lege input', () => {
    expect(bouwOnderzoeksAdresQuery({ adres: null, postcode: null, plaats: null })).toBeNull();
  });

  it('dupliceert plaats niet als die al in adres staat', () => {
    const q = bouwOnderzoeksAdresQuery({
      adres: 'Maaskade 77A-02 Rotterdam',
      postcode: null,
      plaats: 'Rotterdam',
    });
    expect(q).toBe('Maaskade 77A-02 Rotterdam');
  });
});

describe('schoonAdresTekst noise-filter', () => {
  for (const w of [
    'Aanvraag', 'Besluit', 'Verleend', 'Verleende',
    'Omgevingsvergunning', 'Splitsingsvergunning', 'Woonvormingsvergunning',
  ]) {
    it(`verwijdert "${w}"`, () => {
      const t = schoonAdresTekst(`${w} Marco Polostraat 251-H`);
      expect(t.toLowerCase()).not.toContain(w.toLowerCase());
      expect(t).toContain('Marco Polostraat 251-H');
    });
  }
});

describe('Google URLs', () => {
  it('Google Maps encodeert query correct', () => {
    const url = bouwGoogleMapsUrl({
      adres: 'Marco Polostraat 251-H',
      postcode: null,
      plaats: 'Amsterdam',
    });
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=Marco%20Polostraat%20251-H%20Amsterdam',
    );
  });

  it('Google Maps valt terug op lat/lng als geen adres', () => {
    const url = bouwGoogleMapsUrl({
      adres: null, postcode: null, plaats: null, lat: 52.37, lng: 4.89,
    });
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=52.37,4.89');
  });

  it('Google Search gebruikt opgeschoonde query', () => {
    const url = bouwGoogleSearchUrl({
      adres: 'Aanvraag Marco Polostraat 251-H',
      postcode: null,
      plaats: 'Amsterdam',
    });
    expect(url).toBe(
      'https://www.google.com/search?q=Marco%20Polostraat%20251-H%20Amsterdam',
    );
  });
});
