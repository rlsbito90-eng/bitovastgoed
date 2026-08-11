import { describe, expect, it } from 'vitest';
import { filterEnSorteerBagPanden, normaliseerBagServicePand } from './pandenverkennerModel';

const gemengd = normaliseerBagServicePand({
  datasetversie_id: 12,
  identificatie: 'P2',
  voorkomen_sleutel: 'P2:1',
  status: 'Pand in gebruik',
  volgende_cursor: 'P2',
  velden: {
    straat: 'Markt', huisnummer: 10, huisletter: 'A', postcode: '4811AA',
    woonplaats: 'Breda', oorspronkelijkBouwjaar: '1920',
    gebruiksdoelen: ['winkelfunctie', 'woonfunctie'], oppervlakte: '350,5',
    aantalVerblijfsobjecten: 4,
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
      gebruiksdoelen: ['winkelfunctie', 'woonfunctie'], straat: 'Markt', aantalVerblijfsobjecten: 4,
    });
  });

  it('filtert gecombineerd op zoekterm, functie en gemengd gebruik', () => {
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: 'breda', gebruiksdoelen: ['winkel'], alleenGemengd: true, sortering: 'adres_az',
    })).toEqual([gemengd]);
  });

  it('sorteert bouwjaar en GBO beide richtingen met nullwaarden achteraan', () => {
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'bouwjaar_oud_nieuw',
    }).map(pand => pand.bagPandId)).toEqual(['P2', 'P1']);
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'bouwjaar_nieuw_oud',
    }).map(pand => pand.bagPandId)).toEqual(['P1', 'P2']);
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'gbo_groot_klein',
    }).map(pand => pand.bagPandId)).toEqual(['P2', 'P1']);
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'gbo_klein_groot',
    }).map(pand => pand.bagPandId)).toEqual(['P2', 'P1']);
  });

  it('sorteert adres en aantal VBO in beide richtingen', () => {
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'adres_az',
    }).map(pand => pand.bagPandId)).toEqual(['P1', 'P2']);
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'adres_za',
    }).map(pand => pand.bagPandId)).toEqual(['P2', 'P1']);
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'vbo_aantal_hoog_laag',
    }).map(pand => pand.bagPandId)).toEqual(['P2', 'P1']);
    expect(filterEnSorteerBagPanden([kantoor, gemengd], {
      zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'vbo_aantal_laag_hoog',
    }).map(pand => pand.bagPandId)).toEqual(['P1', 'P2']);
  });
});
