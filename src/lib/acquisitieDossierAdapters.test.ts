import { describe, expect, it } from 'vitest';
import {
  offMarketSignaalNaarDossierContext,
  vastgoedkansNaarDossierContext,
} from './acquisitieDossierAdapters';

describe('vastgoedkansNaarDossierContext', () => {
  it('vertaalt camelCase velden naar de gedeelde context', () => {
    expect(vastgoedkansNaarDossierContext({
      id: 'kans-1',
      objectId: 'obj-1',
      adres: 'Doevenkamp 3',
      postcode: '9401 KN',
      plaats: 'Assen',
      eigenaarRelatieId: 'rel-1',
    })).toEqual({
      bronType: 'vastgoedkans',
      bronId: 'kans-1',
      objectId: 'obj-1',
      adres: 'Doevenkamp 3, 9401 KN, Assen',
      plaats: 'Assen',
      eigenaarRelatieId: 'rel-1',
    });
  });

  it('ondersteunt bestaande snake_case koppelingen zonder dataconversie', () => {
    const context = vastgoedkansNaarDossierContext({
      id: 'kans-2',
      object_id: 'obj-2',
      adres: 'Markt 1',
      eigenaar_relatie_id: 'rel-2',
    });
    expect(context.objectId).toBe('obj-2');
    expect(context.eigenaarRelatieId).toBe('rel-2');
  });
});

describe('offMarketSignaalNaarDossierContext', () => {
  it('houdt Off-Market als eigen brontype achter hetzelfde contract', () => {
    expect(offMarketSignaalNaarDossierContext({
      id: 'signaal-1',
      object_id: 'obj-9',
      adres: 'Stationsstraat 10',
      plaats: 'Tilburg',
      eigenaar_relatie_id: 'rel-9',
    })).toEqual({
      bronType: 'off_market_signaal',
      bronId: 'signaal-1',
      objectId: 'obj-9',
      adres: 'Stationsstraat 10, Tilburg',
      plaats: 'Tilburg',
      eigenaarRelatieId: 'rel-9',
    });
  });

  it('geeft voorrang aan camelCase wanneer beide vormen aanwezig zijn', () => {
    const context = offMarketSignaalNaarDossierContext({
      id: 'signaal-2',
      objectId: 'nieuw',
      object_id: 'oud',
      eigenaarRelatieId: 'rel-nieuw',
      eigenaar_relatie_id: 'rel-oud',
    });
    expect(context.objectId).toBe('nieuw');
    expect(context.eigenaarRelatieId).toBe('rel-nieuw');
  });
});
