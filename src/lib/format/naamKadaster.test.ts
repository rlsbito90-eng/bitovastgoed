import { describe, expect, it } from 'vitest';

import {
  naarVoorlettersAchternaam,
  verwijderKadasterGeboorteSuffix,
} from './naam';

describe('Kadaster-persoonsnamen voor briefproductie', () => {
  it('haalt geboortegegevens uit de canonieke briefnaam', () => {
    expect(verwijderKadasterGeboorteSuffix(
      'Evelyn Sabine Blok Geboren 29-04-1959 te AMSTERDAM',
    )).toBe('Evelyn Sabine Blok');
  });

  it('gebruikt daarna dezelfde bestaande initialenlogica als handmatige brieven', () => {
    expect(naarVoorlettersAchternaam(
      'Evelyn Sabine Blok Geboren 29-04-1959 te AMSTERDAM',
    )).toBe('E.S. Blok');
  });

  it('laat rechtspersonen ongemoeid', () => {
    expect(naarVoorlettersAchternaam('Voorbeeld Vastgoed B.V.')).toBe('Voorbeeld Vastgoed B.V.');
  });
});
