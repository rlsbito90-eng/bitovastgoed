import { describe, expect, it } from 'vitest';
import { adressenZijnGelijk, normaliseerAdres, normaliseerPostcode, normaliseerTekst } from '@/lib/objecten/adresNormalisatie';

describe('adresnormalisatie', () => {
  it('normaliseert hoofdletters, diakritische tekens en leestekens', () => {
    expect(normaliseerTekst('  Sint-Jansstraat 10-A,  ')).toBe('sint jansstraat 10 a');
  });

  it('normaliseert Nederlandse postcodes zonder spatie', () => {
    expect(normaliseerPostcode(' 5038 AB ')).toBe('5038AB');
  });

  it('maakt een stabiele samengestelde adressleutel', () => {
    expect(normaliseerAdres({ adres: 'Markt 1', postcode: '5038 AB', plaats: 'Tilburg' }).sleutel)
      .toBe('5038AB|markt 1|tilburg');
  });

  it('herkent equivalent geschreven adressen', () => {
    expect(adressenZijnGelijk(
      { adres: 'Sint-Jansstraat 10-A', postcode: '5038 ab', plaats: 'Tilburg' },
      { adres: 'Sint Jansstraat 10 A', postcode: '5038AB', plaats: 'tilburg' },
    )).toBe(true);
  });
});
