import { describe, expect, it } from 'vitest';

import type { BriefRenderInvoer } from './briefRenderInvoer';
import {
  bouwProductiekernBriefRenderItems,
  mapProductiekernBriefNaarViewModel,
} from './productiekernBriefRenderAdapter';

function maakInvoer(overrides: Partial<BriefRenderInvoer> = {}): BriefRenderInvoer {
  return {
    briefId: 'brief-1',
    briefnummer: 'BR-2026-0001',
    briefVersieId: 'versie-1',
    versienummer: 1,
    onderwerp: 'Interesse in uw pand',
    brieftekst: 'Geachte heer/mevrouw,\n\nTestbrief.',
    objectadres: 'Dorpsstraat 1, 5061 AA Oisterwijk',
    objectomschrijving: 'Dorpsstraat 1 te Oisterwijk',
    aanhef: 'Geachte heer/mevrouw,',
    naam: 'Jan Jansen',
    bedrijfsnaam: null,
    straatHuisnummer: 'Kerkstraat 2',
    postcode: '5061 AB',
    plaats: 'Oisterwijk',
    land: 'Nederland',
    ...overrides,
  };
}

describe('productiekernBriefRenderAdapter', () => {
  it('hergebruikt het bestaande brief-viewmodel zonder database-effecten', () => {
    const vm = mapProductiekernBriefNaarViewModel(maakInvoer());

    expect(vm).toBeTruthy();
    expect(JSON.stringify(vm)).toContain('Jan Jansen');
    expect(JSON.stringify(vm)).toContain('Kerkstraat 2');
    expect(JSON.stringify(vm)).toContain('Dorpsstraat 1 te Oisterwijk');
  });

  it('behoudt de aangeleverde batchvolgorde en stabiele versie-keys', () => {
    const items = bouwProductiekernBriefRenderItems([
      maakInvoer({ briefVersieId: 'versie-b', briefnummer: 'BR-2' }),
      maakInvoer({ briefVersieId: 'versie-a', briefnummer: 'BR-1' }),
    ]);

    expect(items.map((item) => item.key)).toEqual(['versie-b', 'versie-a']);
    expect(items.map((item) => item.briefnummer)).toEqual(['BR-2', 'BR-1']);
  });

  it('weigert een dubbele briefversie in dezelfde renderbatch', () => {
    expect(() => bouwProductiekernBriefRenderItems([
      maakInvoer({ briefVersieId: 'zelfde-versie', briefId: 'brief-1' }),
      maakInvoer({ briefVersieId: 'zelfde-versie', briefId: 'brief-2' }),
    ])).toThrow('Briefversie dubbel in renderbatch');
  });
});
