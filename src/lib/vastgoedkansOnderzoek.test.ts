import { describe, expect, it } from 'vitest';
import { bouwVastgoedkansOnderzoekModel } from './vastgoedkansOnderzoek';

describe('bouwVastgoedkansOnderzoekModel', () => {
  it('bouwt dezelfde externe onderzoeksacties als de Off-Market-werkplek', () => {
    const model = bouwVastgoedkansOnderzoekModel({
      adres: 'Doevenkamp 3',
      postcode: '9401KN',
      plaats: 'Assen',
      bagPandId: '0106100000000001',
      bagVerblijfsobjectId: '0106010000000001',
      herkomst: 'bag_selectie',
      herkomstReferentie: 'Assen pilot',
      algoritmeScore: 83,
      scoreUitleg: 'Transformatiepotentie',
    });

    expect(model.adres).toBe('Doevenkamp 3, 9401KN, Assen');
    expect(model.mapsUrl).toContain('google.com/maps');
    expect(model.googleUrl).toContain('google.com/search');
    expect(model.bagViewerUrl).toContain('bagviewer.kadaster.nl');
    expect(model.kadastraleKaartUrl).toContain('kadastralekaart.com');
    expect(model.heeftBagKoppeling).toBe(true);
    expect(model.kanNaarKadaster).toBe(true);
    expect(model.herkomstLabel).toBe('bag_selectie · Assen pilot');
  });

  it('blokkeert externe acties zonder adres en BAG-koppeling', () => {
    const model = bouwVastgoedkansOnderzoekModel({
      adres: null,
      postcode: null,
      plaats: null,
      bagPandId: null,
      bagVerblijfsobjectId: null,
      herkomst: 'handmatig',
      herkomstReferentie: null,
      algoritmeScore: null,
      scoreUitleg: null,
    });

    expect(model.mapsUrl).toBeNull();
    expect(model.bagViewerUrl).toBeNull();
    expect(model.heeftBagKoppeling).toBe(false);
    expect(model.kanNaarKadaster).toBe(false);
  });
});
