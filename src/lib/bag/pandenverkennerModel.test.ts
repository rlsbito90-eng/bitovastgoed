import { describe, expect, it } from 'vitest';
import { filterEnSorteerBagPanden, normaliseerBagServicePand } from './pandenverkennerModel';

const gemengd = normaliseerBagServicePand({
  datasetversie_id: 12,
  identificatie: 'P2',
  voorkomen_sleutel: 'P2:1',
  status: 'Pand in gebruik',
  volgende_cursor: 'P2',
  velden: {
    straatnaam: 'Markt', huisnummer: 10, huisletter: 'A', postcode: '4811AA',
    woonplaats: 'Breda', bouwjaar: '1920', gebruiksdoel: ['winkelfunctie', 'woonfunctie'],
    oppervlakte: '350,5',
  },
});

const kantoor = normaliseerBagServicePand({
  datasetversie_id: '12', identificatie: 'P1', voorkomen_sleutel: 'P1:1',
  status: null, volgende_cursor: 'P1',
  velden: { adres: 'A-straat 1', gebruiksdoel: 'kantoorfunctie', bouwjaar: 1980 },
});

describe('BAG 2A.10 Pandenverkennermodel', () => {
  it('normaliseert generieke voorkomenvelden zonder brondata te muteren', () => {
    expect(gemengd).toMatchObject({
      datasetversieId: '12', bagPandId: 'P2', adres: 'Markt 10A', adresCompleet: true, plaats: 'Breda',
      bouwjaar: 1920, oppervlakte: 350.5, gemengdGebruik: true,
      gebruiksdoelen: ['winkelfunctie', 'woonfunctie'],
    });
  });

  it('filtert gecombineerd op zoekterm, functie en gemengd gebruik', () => {
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: 'breda', gebruiksdoelen: ['winkel'], alleenGemengd: true, sortering: 'adres',
    })).toEqual([gemengd]);
  });

  it('sorteert nullwaarden stabiel achter geldige bouwjaren en oppervlaktes', () => {
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'bouwjaar',
    }).map(pand => pand.bagPandId)).toEqual(['P2', 'P1']);
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'oppervlakte',
    }).map(pand => pand.bagPandId)).toEqual(['P2', 'P1']);
  });
});
