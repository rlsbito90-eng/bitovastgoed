import { describe, expect, it } from 'vitest';
import type { BagVerkennerPand } from './pandenverkennerModel';
import { maakHandmatigeBagKans } from './handmatigePromotie';

const pand: BagVerkennerPand = {
  datasetversieId: '42', bagPandId: 'P123', voorkomenSleutel: 'P123:7',
  status: 'Pand in gebruik', adres: 'Markt 1', adresCompleet: true,
  postcode: '4811AA', plaats: 'Breda', bouwjaar: 1920,
  gebruiksdoelen: ['winkelfunctie', 'woonfunctie'], oppervlakte: 350,
  gemengdGebruik: true, cursor: 'P123', straat: 'Markt', aantalVerblijfsobjecten: 3,
};

describe('BAG 2A.12 handmatige promotiemapping', () => {
  it('legt dataset, scope, voorkomen en BAG-ID als provenance vast', () => {
    expect(maakHandmatigeBagKans(pand, 'NB')).toMatchObject({
      adres: 'Markt 1', postcode: '4811AA', plaats: 'Breda',
      bagPandId: 'P123', herkomst: 'bag_selectie',
      herkomstReferentie: 'Private BAG scope NB; dataset 42; voorkomen P123:7',
      korteOmschrijving: 'Gemengd pand — Markt 1',
    });
  });

  it('start alle acquisitie- en Kadasterstappen expliciet onaangeraakt', () => {
    expect(maakHandmatigeBagKans(pand, 'NB')).toMatchObject({
      status: 'te_beoordelen', prioriteit: 3,
      eigenaarStatus: 'niet_gestart', kadasterStatus: 'niet_gestart',
      briefStatus: 'niet_gestart', reactieStatus: 'geen_reactie',
    });
  });
});
