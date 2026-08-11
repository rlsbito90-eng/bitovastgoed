import { describe, expect, it } from 'vitest';
import { assertBagV2ResultatenVoldoenAanFilters } from './zoekResultaatGuard';
import type { BagPandZoekAanvraagV2 } from './queryService';

const basis: BagPandZoekAanvraagV2 = {
  scopeCode: '0363',
  naIdentificatie: null,
  limiet: 100,
  bouwjaarVan: null,
  bouwjaarTot: null,
  status: null,
  vboOppervlakteSomVan: null,
  vboOppervlakteSomTot: null,
  vboOppervlakteMaxVan: null,
  vboOppervlakteMaxTot: null,
  vboAantalVan: null,
  vboAantalTot: null,
  gebruiksdoel: null,
  isGemengd: null,
  vboModus: 'alle',
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

describe('Pandenverkenner v2 resultaatguard', () => {
  it('accepteert een resultaat dat exact aan gecombineerde filters voldoet', () => {
    expect(() => assertBagV2ResultatenVoldoenAanFilters([rij], {
      ...basis,
      vboOppervlakteSomVan: 200,
      vboAantalTot: 2,
      gebruiksdoel: 'winkelfunctie',
      isGemengd: true,
    })).not.toThrow();
  });

  it('blokkeert een pand van 156 m² bij GBO totaal vanaf 200', () => {
    expect(() => assertBagV2ResultatenVoldoenAanFilters([
      { ...rij, vbo_oppervlakte_som: 156 },
    ], { ...basis, vboOppervlakteSomVan: 200 })).toThrow(/niet aan de toegepaste filters/);
  });

  it('borgt ook grootste VBO, VBO-aantal, status en gebruik', () => {
    expect(() => assertBagV2ResultatenVoldoenAanFilters([
      { ...rij, vbo_oppervlakte_max: 90 },
    ], { ...basis, vboOppervlakteMaxVan: 100 })).toThrow();
    expect(() => assertBagV2ResultatenVoldoenAanFilters([
      { ...rij, vbo_aantal: 3 },
    ], { ...basis, vboAantalTot: 2 })).toThrow();
    expect(() => assertBagV2ResultatenVoldoenAanFilters([
      { ...rij, status: 'Pand gesloopt' },
    ], { ...basis, status: 'Pand in gebruik' })).toThrow();
    expect(() => assertBagV2ResultatenVoldoenAanFilters([
      { ...rij, gebruiksdoelen: ['woonfunctie'] },
    ], { ...basis, gebruiksdoel: 'winkelfunctie' })).toThrow();
  });
});
