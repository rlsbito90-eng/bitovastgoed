import { describe, expect, it } from 'vitest';
import { bouwGoogleMapsAdresUrl, bouwGoogleMapsAdresZoekterm } from './googleMaps';

describe('Google Maps-adreslink', () => {
  it('bouwt een leesbare zoekterm uit adres, postcode en plaats', () => {
    expect(bouwGoogleMapsAdresZoekterm({
      adres: 'Ceresplein 23',
      postcode: '9401CW',
      plaats: 'Assen',
    })).toBe('Ceresplein 23, 9401CW, Assen');
  });

  it('codeert het volledige adres veilig in een Google Maps search URL', () => {
    const url = bouwGoogleMapsAdresUrl({
      adres: 'Ceresplein 23',
      postcode: '9401CW',
      plaats: 'Assen',
    });

    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Ceresplein+23%2C+9401CW%2C+Assen');
  });

  it('blijft bruikbaar wanneer postcode of plaats ontbreekt', () => {
    expect(bouwGoogleMapsAdresZoekterm({ adres: 'Damrak 1', postcode: null, plaats: 'Amsterdam' }))
      .toBe('Damrak 1, Amsterdam');
  });
});
