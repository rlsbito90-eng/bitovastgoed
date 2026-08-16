import { describe, expect, it, vi } from 'vitest';

import { bepaalBulkKadasterAdresMetBag } from './bulkKadaster';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

function signaal(overrides: Record<string, unknown> = {}): OffMarketSignaal {
  return {
    id: 'signaal-1',
    adres: 'Baerlestraat 18',
    postcode: null,
    plaats: 'Amsterdam',
    titel: 'Aanvraag splitsingsvergunning Van Baerlestraat 18',
    bag_match_kandidaten: [
      {
        adres: 'Van Baerlestraat 18-H, 1071AW Amsterdam',
        postcode: '1071AW',
        huisnummer: '18',
        huisletter: null,
        huisnummertoevoeging: 'H',
        openbareruimte: 'Van Baerlestraat',
        woonplaats: 'Amsterdam',
      },
      {
        adres: 'Van Baerlestraat 18-1, 1071AW Amsterdam',
        postcode: '1071AW',
        huisnummer: '18',
        huisletter: null,
        huisnummertoevoeging: '1',
        openbareruimte: 'Van Baerlestraat',
        woonplaats: 'Amsterdam',
      },
    ],
    ...overrides,
  } as unknown as OffMarketSignaal;
}

describe('bulk Kadaster gebruikt reeds opgeslagen BAG-kandidaten', () => {
  it('herstelt Van Baerlestraat 18 zonder nieuwe PDOK-lookup en kiest H', async () => {
    const bagZoeker = vi.fn(async () => []);

    const resultaat = await bepaalBulkKadasterAdresMetBag(signaal(), bagZoeker);

    expect(bagZoeker).not.toHaveBeenCalled();
    expect(resultaat.status).toBe('klaar');
    expect(resultaat.zoekadresLabel).toBe('1071AW 18 H');
    expect(resultaat.adresInput).toMatchObject({
      postalcode: '1071AW',
      houseNumber: '18',
      houseNumberAddition: 'H',
    });
    expect(resultaat.reden).toContain('opgeslagen BAG');
  });
});
