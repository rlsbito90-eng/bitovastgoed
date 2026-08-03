import { describe, expect, it } from 'vitest';
import type { BagVerkennerPand } from './pandenverkennerModel';
import { bagAdresSleutel, beoordeelBagSelectie } from './selectiePreflight';

function pand(overrides: Partial<BagVerkennerPand> = {}): BagVerkennerPand {
  return {
    datasetversieId: '1', bagPandId: 'P1', voorkomenSleutel: 'P1:1', status: null,
    adres: 'Markt 1', adresCompleet: true, postcode: '4811AA', plaats: 'Breda',
    bouwjaar: 1900, gebruiksdoelen: ['winkelfunctie'], oppervlakte: 100,
    gemengdGebruik: false, cursor: 'P1', ...overrides,
  };
}

describe('BAG 2A.11 selectiepreflight', () => {
  it('laat alleen een niet-bestaand pand met bronadres door', () => {
    const resultaat = beoordeelBagSelectie([pand()], new Set(['P1']), {
      bestaandeBagIds: new Set(), bestaandeAdresSleutels: new Set(),
    });
    expect(resultaat).toMatchObject({ toegestaan: true, geselecteerd: 1, blokkades: [] });
    expect(resultaat.kandidaten).toHaveLength(1);
  });

  it('blokkeert BAG-ID en genormaliseerd adres afzonderlijk', () => {
    const p1 = pand();
    const p2 = pand({ bagPandId: 'P2', adres: 'Andere 2', postcode: null });
    const resultaat = beoordeelBagSelectie([p1, p2], new Set(['P1', 'P2']), {
      bestaandeBagIds: new Set(['P1']),
      bestaandeAdresSleutels: new Set([bagAdresSleutel('Andere 2', null)]),
    });
    expect(resultaat.toegestaan).toBe(false);
    expect(resultaat.blokkades).toEqual([
      { bagPandId: 'P1', reden: 'bestaand_bag_id' },
      { bagPandId: 'P2', reden: 'bestaand_adres' },
    ]);
  });

  it('blokkeert een fallbackadres en overschrijding van de selectielimiet', () => {
    expect(beoordeelBagSelectie(
      [pand({ adresCompleet: false })], new Set(['P1']),
      { bestaandeBagIds: new Set(), bestaandeAdresSleutels: new Set() },
    ).blokkades[0].reden).toBe('onvolledig_adres');

    const panden = Array.from({ length: 3 }, (_, index) => pand({ bagPandId: `P${index}` }));
    const resultaat = beoordeelBagSelectie(panden, new Set(panden.map(item => item.bagPandId)), {
      bestaandeBagIds: new Set(), bestaandeAdresSleutels: new Set(), maximaalAantal: 2,
    });
    expect(resultaat.kandidaten).toEqual([]);
    expect(resultaat.blokkades.every(item => item.reden === 'selectielimiet')).toBe(true);
  });
});
