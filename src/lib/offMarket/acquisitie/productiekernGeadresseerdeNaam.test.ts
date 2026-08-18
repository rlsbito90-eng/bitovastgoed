import { describe, expect, it } from 'vitest';

import { productiekernGeadresseerdeNaam } from './productiekernGeadresseerdeNaam';

describe('productiekernGeadresseerdeNaam', () => {
  it.each([
    ['Evelyn Sabine Blok Geboren 29-04-1959 te AMSTERDAM', 'E.S. Blok'],
    ['Piet Adriaan Johan Geluk Geboren 20-01-1980 te WINSCHOTEN', 'P.A.J. Geluk'],
    ['Johanna Petronella Kempen Geboren 20-06-1974 te EERSEL', 'J.P. Kempen'],
  ])('normaliseert natuurlijke persoon %s', (naam, verwacht) => {
    expect(productiekernGeadresseerdeNaam({ naam, bedrijfsnaam: null })).toBe(verwacht);
  });

  it.each([
    'Bloemgracht 24 B.V.',
    'Paul Vismans Projecten Beheer Twee B.V.',
    'Spring Properties F S.à r.l.',
  ])('behoudt rechtspersoon exact: %s', (naam) => {
    expect(productiekernGeadresseerdeNaam({ naam: null, bedrijfsnaam: naam })).toBe(naam);
  });

  it('laat een rechtspersoon in legacy naamveld intact', () => {
    expect(productiekernGeadresseerdeNaam({
      naam: 'Spring Properties F S.à r.l.',
      bedrijfsnaam: null,
    })).toBe('Spring Properties F S.à r.l.');
  });
});
