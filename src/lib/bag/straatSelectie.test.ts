import { describe, expect, it } from 'vitest';
import type { BagVerkennerPand } from './pandenverkennerModel';
import { bepaalStraatSelectieStatus, toggleStraatSelectie } from './straatSelectie';

function pand(id: string, adres = `Straat ${id}`): BagVerkennerPand {
  return {
    bagPandId: id,
    adres,
    postcode: '1234AB',
    plaats: 'Teststad',
    straat: 'Teststraat',
    bouwjaar: null,
    oppervlakte: null,
    gebruiksdoelen: [],
    aantalVerblijfsobjecten: 0,
    gemengdGebruik: false,
    status: null,
    adresCompleet: true,
    datasetversieId: 'dataset-1',
    voorkomenSleutel: `voorkomen-${id}`,
    cursor: id,
  };
}

const nietGeblokkeerd = () => false;

describe('straatselectie', () => {
  it('selecteert alle beschikbare panden uit een straat', () => {
    const resultaat = toggleStraatSelectie([pand('1'), pand('2')], new Set(), nietGeblokkeerd);
    expect([...resultaat ?? []]).toEqual(['1', '2']);
  });

  it('deselecteert de straat wanneer alle beschikbare panden al geselecteerd zijn', () => {
    const resultaat = toggleStraatSelectie(
      [pand('1'), pand('2')],
      new Set(['1', '2', 'buiten-straat']),
      nietGeblokkeerd,
    );
    expect([...resultaat ?? []]).toEqual(['buiten-straat']);
  });

  it('slaat geblokkeerde panden over', () => {
    const resultaat = toggleStraatSelectie(
      [pand('1'), pand('2')],
      new Set(),
      kandidaat => kandidaat.bagPandId === '2',
    );
    expect([...resultaat ?? []]).toEqual(['1']);
  });

  it('retourneert null wanneer de selectielimiet wordt overschreden', () => {
    const resultaat = toggleStraatSelectie(
      [pand('2')],
      new Set(['1']),
      nietGeblokkeerd,
      1,
    );
    expect(resultaat).toBeNull();
  });

  it('rapporteert gedeeltelijke en volledige straatselectie', () => {
    const panden = [pand('1'), pand('2'), pand('3')];
    expect(bepaalStraatSelectieStatus(panden, new Set(['1']), kandidaat => kandidaat.bagPandId === '3'))
      .toEqual({ beschikbaar: 2, geselecteerd: 1, allesGeselecteerd: false, gedeeltelijkGeselecteerd: true });
    expect(bepaalStraatSelectieStatus(panden, new Set(['1', '2']), kandidaat => kandidaat.bagPandId === '3'))
      .toEqual({ beschikbaar: 2, geselecteerd: 2, allesGeselecteerd: true, gedeeltelijkGeselecteerd: false });
  });
});
