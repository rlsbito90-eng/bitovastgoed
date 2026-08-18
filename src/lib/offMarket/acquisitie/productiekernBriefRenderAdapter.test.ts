import { describe, expect, it } from 'vitest';

import type { BriefRenderInvoer } from './briefRenderInvoer';
import {
  bouwProductiekernBriefRenderItems,
  mapProductiekernBriefNaarViewModel,
} from './productiekernBriefRenderAdapter';

function maakInvoer(overrides: Partial<BriefRenderInvoer> = {}): BriefRenderInvoer {
  return {
    briefId: 'brief-1',
    briefnummer: 'BR2026000001',
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
  it('normaliseert een natuurlijke persoon en houdt de naam uit de adresregels', () => {
    const vm = mapProductiekernBriefNaarViewModel(maakInvoer({
      naam: 'Evelyn Sabine Blok Geboren 29-04-1959 te AMSTERDAM',
    }));

    expect(vm.geadresseerdeNaam).toBe('E.S. Blok');
    expect(vm.bedrijfsnaam).toBe('');
    expect(vm.verzendadresRegels).toEqual(['Kerkstraat 2', '5061 AB Oisterwijk']);
    expect(vm.verzendadresRegels.join(' ')).not.toContain('Geboren');
    expect(vm.verzendadresRegels).not.toContain('E.S. Blok');
  });

  it('rendert een rechtspersoon precies één keer als naam en niet opnieuw in verzendadres', () => {
    const vm = mapProductiekernBriefNaarViewModel(maakInvoer({
      naam: 'Bloemgracht 24 B.V.',
      bedrijfsnaam: 'Bloemgracht 24 B.V.',
    }));

    expect(vm.bedrijfsnaam).toBe('Bloemgracht 24 B.V.');
    expect(vm.geadresseerdeNaam).toBe('');
    expect(vm.verzendadresRegels).toEqual(['Kerkstraat 2', '5061 AB Oisterwijk']);
    expect(vm.verzendadresRegels).not.toContain('Bloemgracht 24 B.V.');
  });

  it('behoudt de aangeleverde batchvolgorde en stabiele versie-keys', () => {
    const items = bouwProductiekernBriefRenderItems([
      maakInvoer({ briefVersieId: 'versie-b', briefnummer: 'BR2026000002' }),
      maakInvoer({ briefVersieId: 'versie-a', briefnummer: 'BR2026000001' }),
    ]);

    expect(items.map((item) => item.key)).toEqual(['versie-b', 'versie-a']);
    expect(items.map((item) => item.briefnummer)).toEqual(['BR2026000002', 'BR2026000001']);
  });

  it('weigert een dubbele briefversie in dezelfde renderbatch', () => {
    expect(() => bouwProductiekernBriefRenderItems([
      maakInvoer({ briefVersieId: 'zelfde-versie', briefId: 'brief-1' }),
      maakInvoer({ briefVersieId: 'zelfde-versie', briefId: 'brief-2' }),
    ])).toThrow('Briefversie dubbel in renderbatch');
  });
});
