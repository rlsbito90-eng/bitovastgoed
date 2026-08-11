import { describe, expect, it } from 'vitest';
import { assertBagV2ResultatenVoldoenAanFilters, assertBagV3ResultatenVoldoenAanFilters } from './zoekResultaatGuard';
import type { BagPandZoekAanvraagV2, BagPandZoekAanvraagV3 } from './queryService';

const basisV2: BagPandZoekAanvraagV2 = {
  scopeCode: '0363', naIdentificatie: null, limiet: 100,
  bouwjaarVan: null, bouwjaarTot: null, status: null,
  vboOppervlakteSomVan: null, vboOppervlakteSomTot: null,
  vboOppervlakteMaxVan: null, vboOppervlakteMaxTot: null,
  vboAantalVan: null, vboAantalTot: null, gebruiksdoel: null,
  isGemengd: null, vboModus: 'alle',
};

const basisV3: BagPandZoekAanvraagV3 = {
  scopeCode: '0363', naIdentificatie: null, limiet: 100,
  bouwjaarVan: null, bouwjaarTot: null, statussen: [],
  vboOppervlakteSomVan: null, vboOppervlakteSomTot: null,
  vboOppervlakteMaxVan: null, vboOppervlakteMaxTot: null,
  vboAantalVan: null, vboAantalTot: null, gebruiksdoelen: [],
  isGemengd: null, vboModus: 'alle',
};

const rij = {
  bouwjaar: 1954,
  status: 'Pand in gebruik',
  heeft_vbo: true,
  vbo_aantal: 2,
  vbo_oppervlakte_som: 246,
  vbo_oppervlakte_max: 173,
  gebruiksdoelen: ['winkelfunctie', 'woonfunctie'],
  is_gemengd: true,
};

describe('Pandenverkenner resultaatguard', () => {
  it('accepteert een v2-resultaat dat exact aan gecombineerde filters voldoet', () => {
    expect(() => assertBagV2ResultatenVoldoenAanFilters([rij], {
      ...basisV2, vboOppervlakteSomVan: 200, vboAantalTot: 2,
      gebruiksdoel: 'winkelfunctie', isGemengd: true,
    })).not.toThrow();
  });

  it('blokkeert een pand van 156 m² bij GBO totaal vanaf 200', () => {
    expect(() => assertBagV2ResultatenVoldoenAanFilters([
      { ...rij, vbo_oppervlakte_som: 156 },
    ], { ...basisV2, vboOppervlakteSomVan: 200 })).toThrow(/niet aan de toegepaste filters/);
  });

  it('borgt in v3 OR binnen statusselectie en AND met overige filtergroepen', () => {
    expect(() => assertBagV3ResultatenVoldoenAanFilters([
      { ...rij, status: 'Bouw gestart' },
    ], {
      ...basisV3,
      statussen: ['Bouw gestart', 'Bouwvergunning verleend'],
      vboOppervlakteSomVan: 200,
    })).not.toThrow();

    expect(() => assertBagV3ResultatenVoldoenAanFilters([
      { ...rij, status: 'Pand gesloopt' },
    ], {
      ...basisV3,
      statussen: ['Bouw gestart', 'Bouwvergunning verleend'],
      vboOppervlakteSomVan: 200,
    })).toThrow();
  });

  it('borgt in v3 OR binnen gebruiksfuncties', () => {
    expect(() => assertBagV3ResultatenVoldoenAanFilters([rij], {
      ...basisV3,
      gebruiksdoelen: ['kantoorfunctie', 'winkelfunctie'],
    })).not.toThrow();

    expect(() => assertBagV3ResultatenVoldoenAanFilters([rij], {
      ...basisV3,
      gebruiksdoelen: ['kantoorfunctie', 'logiesfunctie'],
    })).toThrow();
  });
});
