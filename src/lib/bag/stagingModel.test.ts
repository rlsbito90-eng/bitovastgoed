import { describe, expect, it } from 'vitest';
import { bouwBagStagingModel, stagingFingerprint } from './stagingModel';

const basis = {
  beginGeldigheid: '2020-01-01',
  eindGeldigheid: null,
  tijdstipRegistratie: '2020-01-01T00:00:00Z',
  eindRegistratie: null,
  tijdstipInactief: null,
  status: 'in gebruik',
  velden: {},
};

describe('bouwBagStagingModel', () => {
  it('splitst objecten, voorkomens, relaties en geometrieën', () => {
    const model = bouwBagStagingModel([{
      ...basis,
      objecttype: 'Verblijfsobject',
      identificatie: 'vbo-1',
      voorkomenidentificatie: 1,
      relaties: { hoofdadres: ['num-1'], maaktDeelUitVan: ['pand-1'] },
      geometrie: { crs: 'EPSG:28992', dimensie: 3, coordinaten: [100, 200, 0] },
    }]);

    expect(model.objecten).toHaveLength(1);
    expect(model.voorkomens[0].isActueel).toBe(true);
    expect(model.relaties).toEqual([
      { bronObjecttype: 'Verblijfsobject', bronIdentificatie: 'vbo-1', relatietype: 'hoofdadres', doelIdentificatie: 'num-1' },
      { bronObjecttype: 'Verblijfsobject', bronIdentificatie: 'vbo-1', relatietype: 'maaktDeelUitVan', doelIdentificatie: 'pand-1' },
    ]);
    expect(model.geometrieen[0].crs).toBe('EPSG:28992');
    expect(model.geometrieen[0]).toMatchObject({
      beginGeldigheid: basis.beginGeldigheid,
      eindGeldigheid: basis.eindGeldigheid,
      tijdstipRegistratie: basis.tijdstipRegistratie,
      eindRegistratie: basis.eindRegistratie,
      tijdstipInactief: basis.tijdstipInactief,
    });
  });

  it('behoudt historie en selecteert het actuele voorkomen', () => {
    const model = bouwBagStagingModel([
      { ...basis, objecttype: 'Pand', identificatie: 'pand-1', voorkomenidentificatie: 1, eindGeldigheid: '2021-01-01', relaties: {} },
      { ...basis, objecttype: 'Pand', identificatie: 'pand-1', voorkomenidentificatie: 2, relaties: {} },
    ]);

    expect(model.voorkomens).toHaveLength(2);
    expect(model.objecten[0].actueleVoorkomenidentificatie).toBe(2);
    expect(model.voorkomens.find(item => item.voorkomenidentificatie === 1)?.isActueel).toBe(false);
  });

  it('rapporteert meerdere actuele voorkomens', () => {
    const model = bouwBagStagingModel([
      { ...basis, objecttype: 'Pand', identificatie: 'pand-1', voorkomenidentificatie: 1, relaties: {} },
      { ...basis, objecttype: 'Pand', identificatie: 'pand-1', voorkomenidentificatie: 2, relaties: {} },
    ]);
    expect(model.objecten[0].actueleVoorkomenidentificatie).toBe(2);
    expect(model.fouten[0].code).toBe('meerdere_actuele_voorkomens');
  });

  it('weigert geometrie met onjuiste dimensie', () => {
    const model = bouwBagStagingModel([{
      ...basis,
      objecttype: 'Pand',
      identificatie: 'pand-1',
      voorkomenidentificatie: 1,
      relaties: {},
      geometrie: { crs: 'EPSG:28992', dimensie: 3, coordinaten: [1, 2, 3, 4] },
    }]);
    expect(model.geometrieen).toHaveLength(0);
    expect(model.fouten[0].code).toBe('ongeldige_geometrie');
  });

  it('is deterministisch onafhankelijk van invoervolgorde', () => {
    const a = { ...basis, objecttype: 'Pand', identificatie: 'pand-2', voorkomenidentificatie: 1, relaties: {} };
    const b = { ...basis, objecttype: 'Pand', identificatie: 'pand-1', voorkomenidentificatie: 1, relaties: {} };
    expect(stagingFingerprint(bouwBagStagingModel([a, b]))).toBe(stagingFingerprint(bouwBagStagingModel([b, a])));
  });

  it('behoudt twee geometrieën met dezelfde officiële voorkomen-ID als afzonderlijke voorkomens', () => {
    const model = bouwBagStagingModel([
      {
        ...basis,
        objecttype: 'Verblijfsobject',
        identificatie: '0106010000033804',
        voorkomenidentificatie: 1,
        tijdstipRegistratie: '2009-11-06T13:37:13.000',
        status: 'Verblijfsobject gevormd',
        relaties: {},
        geometrie: { crs: 'EPSG:28992', dimensie: 3, coordinaten: [100, 200, 0] },
      },
      {
        ...basis,
        objecttype: 'Verblijfsobject',
        identificatie: '0106010000033804',
        voorkomenidentificatie: 1,
        eindGeldigheid: '2011-01-06',
        tijdstipRegistratie: '2011-07-12T11:03:58.000',
        eindRegistratie: '2011-07-12T11:03:58.000',
        status: 'Verblijfsobject in gebruik',
        relaties: {},
        geometrie: { crs: 'EPSG:28992', dimensie: 3, coordinaten: [101, 201, 0] },
      },
    ]);

    expect(model.geometrieen).toHaveLength(2);
    expect(model.geometrieen.map(item => item.tijdstipRegistratie)).toEqual([
      '2009-11-06T13:37:13.000',
      '2011-07-12T11:03:58.000',
    ]);
  });
});
