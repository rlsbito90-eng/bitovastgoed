import { describe, expect, it } from 'vitest';

import {
  weergaveadresGeadresseerde,
  weergavenaamGeadresseerde,
} from '@/components/offmarket/acquisitie/GeadresseerdenLijst';

describe('Acquisitieselectie eigenaar/geadresseerde-presentatie', () => {
  it('maakt een Kadaster-persoonsnaam scanbaar met voorletters', () => {
    expect(weergavenaamGeadresseerde({
      key: 'persoon',
      naam: 'Evelyn Sabine Blok Geboren 29-04-1959 te AMSTERDAM',
      bedrijfsnaam: null,
      verzendadres: 'Herengracht 1 1015 AA Amsterdam',
      volledigPostadres: true,
    })).toBe('E.S. Blok');
  });

  it('laat een bedrijfsnaam intact', () => {
    expect(weergavenaamGeadresseerde({
      key: 'bedrijf',
      naam: null,
      bedrijfsnaam: 'J.H.F. Schopman en Zonen B.V.',
      verzendadres: 'Keizersgracht 10 1015 AA Amsterdam',
      volledigPostadres: true,
    })).toBe('J.H.F. Schopman en Zonen B.V.');
  });

  it('normaliseert het correspondentieadres zonder de inhoud te veranderen', () => {
    expect(weergaveadresGeadresseerde('  Keizersgracht 10\n1015 AA   Amsterdam  '))
      .toBe('Keizersgracht 10 1015 AA Amsterdam');
    expect(weergaveadresGeadresseerde('   ')).toBeNull();
  });
});
