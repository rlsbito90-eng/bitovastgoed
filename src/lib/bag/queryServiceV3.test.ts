import { describe, expect, it } from 'vitest';
import { valideerPandZoekAanvraagV3, type BagPandZoekAanvraagV3 } from './queryService';

const basis: BagPandZoekAanvraagV3 = {
  scopeCode: '0363',
  naIdentificatie: null,
  limiet: 100,
  bouwjaarVan: null,
  bouwjaarTot: null,
  statussen: [],
  vboOppervlakteSomVan: null,
  vboOppervlakteSomTot: null,
  vboOppervlakteMaxVan: null,
  vboOppervlakteMaxTot: null,
  vboAantalVan: null,
  vboAantalTot: null,
  gebruiksdoelen: [],
  isGemengd: null,
  vboModus: 'alle',
};

describe('Pandenverkenner v3 multiselect querycontract', () => {
  it('accepteert meerdere statussen en gebruiksfuncties', () => {
    const resultaat = valideerPandZoekAanvraagV3({
      ...basis,
      statussen: ['Bouw gestart', 'Bouwvergunning verleend'],
      gebruiksdoelen: ['winkelfunctie', 'kantoorfunctie'],
      vboOppervlakteSomVan: 200,
    });
    expect(resultaat).toEqual({ geldig: true, fouten: [] });
  });

  it('accepteert lege selecties als geen filter', () => {
    expect(valideerPandZoekAanvraagV3(basis).geldig).toBe(true);
  });

  it('weigert dubbele of te grote multiselects', () => {
    expect(valideerPandZoekAanvraagV3({
      ...basis,
      statussen: ['Pand in gebruik', 'Pand in gebruik'],
    }).geldig).toBe(false);
    expect(valideerPandZoekAanvraagV3({
      ...basis,
      gebruiksdoelen: Array.from({ length: 17 }, (_, index) => `functie-${index}`),
    }).geldig).toBe(false);
  });

  it('blijft numerieke bereiken en VBO-modus valideren', () => {
    const resultaat = valideerPandZoekAanvraagV3({
      ...basis,
      bouwjaarVan: 2000,
      bouwjaarTot: 1900,
      vboOppervlakteSomVan: 500,
      vboOppervlakteSomTot: 200,
    });
    expect(resultaat.geldig).toBe(false);
    expect(resultaat.fouten).toContain('Bouwjaar vanaf mag niet hoger zijn dan bouwjaar tot.');
    expect(resultaat.fouten).toContain('VBO-oppervlakte som vanaf mag niet hoger zijn dan tot.');
  });
});
