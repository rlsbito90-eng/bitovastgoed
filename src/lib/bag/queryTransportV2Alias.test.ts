import { describe, expect, it } from 'vitest';
import { normaliseerPandZoekAanvraagV2 } from './queryTransport';

const basis = {
  scopeCode: '0363',
  naIdentificatie: null,
  limiet: 100,
  bouwjaarVan: null,
  bouwjaarTot: null,
  status: null,
  vboAantalVan: null,
  vboAantalTot: null,
  gebruiksdoel: 'woonfunctie',
  isGemengd: null,
  vboModus: 'alle',
};

describe('Pandenverkenner 2.0 VBO-filtermapping', () => {
  it('normaliseert de korte UI-aliases naar het canonieke querycontract', () => {
    const resultaat = normaliseerPandZoekAanvraagV2({
      ...basis,
      vboSomVan: 200,
      vboSomTot: 5000,
      vboMaxVan: 100,
      vboMaxTot: 1000,
    });

    expect(resultaat.vboOppervlakteSomVan).toBe(200);
    expect(resultaat.vboOppervlakteSomTot).toBe(5000);
    expect(resultaat.vboOppervlakteMaxVan).toBe(100);
    expect(resultaat.vboOppervlakteMaxTot).toBe(1000);
  });

  it('maakt ontbrekende VBO-oppervlaktefilters expliciet null', () => {
    const resultaat = normaliseerPandZoekAanvraagV2(basis);

    expect(resultaat.vboOppervlakteSomVan).toBeNull();
    expect(resultaat.vboOppervlakteSomTot).toBeNull();
    expect(resultaat.vboOppervlakteMaxVan).toBeNull();
    expect(resultaat.vboOppervlakteMaxTot).toBeNull();
  });

  it('geeft canonieke veldnamen voorrang boven legacy UI-aliases', () => {
    const resultaat = normaliseerPandZoekAanvraagV2({
      ...basis,
      vboOppervlakteSomVan: 250,
      vboSomVan: 200,
      vboOppervlakteMaxVan: 150,
      vboMaxVan: 100,
    });

    expect(resultaat.vboOppervlakteSomVan).toBe(250);
    expect(resultaat.vboOppervlakteMaxVan).toBe(150);
  });
});
