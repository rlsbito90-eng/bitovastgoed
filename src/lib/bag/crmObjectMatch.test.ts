import { describe, expect, it } from 'vitest';
import { bouwCrmObjectMatchIndex, vindCrmObjectMatch } from './crmObjectMatch';

const pand = {
  bagPandId: '0363100012061971',
  adres: 'Belgiëplein 53',
  postcode: '1066RC',
};

describe('CRM-brede BAG-objectcontrole', () => {
  it('gebruikt BAG-ID als primaire match', () => {
    const index = bouwCrmObjectMatchIndex([
      { bron: 'object', recordId: 'o1', route: '/objecten/o1', bagPandId: pand.bagPandId, adres: 'Ander adres', postcode: null },
      { bron: 'signaal', recordId: 's1', route: '/off-market/s1', adres: pand.adres, postcode: pand.postcode },
    ]);
    expect(vindCrmObjectMatch(pand, index)).toMatchObject({ bron: 'object', recordId: 'o1', matchtype: 'bag_id' });
  });

  it('valt terug op genormaliseerd adres wanneer BAG-ID ontbreekt', () => {
    const index = bouwCrmObjectMatchIndex([
      { bron: 'signaal', recordId: 's1', route: '/off-market/s1', adres: 'Belgiëplein 53', postcode: '1066 RC' },
    ]);
    expect(vindCrmObjectMatch(pand, index)).toMatchObject({ bron: 'signaal', recordId: 's1', matchtype: 'adres' });
  });

  it('geeft Vastgoedkans voorrang bij meerdere CRM-bronnen op hetzelfde adres', () => {
    const index = bouwCrmObjectMatchIndex([
      { bron: 'signaal', recordId: 's1', route: '/off-market/s1', adres: pand.adres, postcode: pand.postcode },
      { bron: 'vastgoedkans', recordId: 'k1', route: '/vastgoedkansen/k1', adres: pand.adres, postcode: pand.postcode },
    ]);
    expect(vindCrmObjectMatch(pand, index)).toMatchObject({ bron: 'vastgoedkans', recordId: 'k1' });
  });

  it('retourneert null voor een nieuw pand', () => {
    const index = bouwCrmObjectMatchIndex([]);
    expect(vindCrmObjectMatch(pand, index)).toBeNull();
  });
});
