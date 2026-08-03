import { describe, expect, it } from 'vitest';
import {
  BAG_DATABASE_IMPORT_ONTWERP,
  valideerBagDatabaseImportOntwerp,
  type BagDatabaseImportOntwerp,
} from './databaseImportOntwerp';

describe('BAG database-importontwerp', () => {
  it('bevat gescheiden staging- en published-lagen', () => {
    expect(BAG_DATABASE_IMPORT_ONTWERP.tabellen.some(item => item.laag === 'staging')).toBe(true);
    expect(BAG_DATABASE_IMPORT_ONTWERP.tabellen.some(item => item.laag === 'published')).toBe(true);
    expect(BAG_DATABASE_IMPORT_ONTWERP.publicatie.strategie).toBe('datasetversie_omschakeling');
  });

  it('borgt samengestelde sleutels per datasetversie', () => {
    const voorkomens = BAG_DATABASE_IMPORT_ONTWERP.tabellen.find(item => item.naam === 'bag_staging_voorkomens');
    expect(voorkomens?.primaireSleutel).toEqual([
      'datasetversie_id',
      'objecttype',
      'identificatie',
      'voorkomenidentificatie',
    ]);

    const relaties = BAG_DATABASE_IMPORT_ONTWERP.tabellen.find(item => item.naam === 'bag_staging_relaties');
    expect(relaties?.primaireSleutel).toContain('relatietype');
    expect(relaties?.primaireSleutel).toContain('doel_identificatie');
  });

  it('gebruikt RD New en GiST-indexen voor ruimtelijke tabellen', () => {
    expect(BAG_DATABASE_IMPORT_ONTWERP.srid).toBe(28992);
    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrieTypes.punt).toBe('geometry(PointZ,28992)');
    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrieTypes.polygoon).toBe('geometry(PolygonZ,28992)');

    for (const tabel of BAG_DATABASE_IMPORT_ONTWERP.tabellen.filter(item => item.naam.includes('geometrie'))) {
      expect(tabel.indexen.some(index => index.type === 'gist')).toBe(true);
    }
  });

  it('verbiedt CRM-schrijfacties en bewaart de vorige datasetversie', () => {
    expect(BAG_DATABASE_IMPORT_ONTWERP.publicatie.crmSchrijfactiesToegestaan).toBe(false);
    expect(BAG_DATABASE_IMPORT_ONTWERP.publicatie.vorigeVersieBewaren).toBe(true);
  });

  it('keurt het standaardontwerp goed', () => {
    expect(valideerBagDatabaseImportOntwerp()).toEqual({ toegestaan: true, blokkades: [] });
  });

  it('blokkeert een ontwerp zonder staginglaag of juiste SRID', () => {
    const ongeldig: BagDatabaseImportOntwerp = {
      ...BAG_DATABASE_IMPORT_ONTWERP,
      srid: 4326 as 28992,
      tabellen: BAG_DATABASE_IMPORT_ONTWERP.tabellen.filter(item => item.laag !== 'staging'),
    };

    const resultaat = valideerBagDatabaseImportOntwerp(ongeldig);
    expect(resultaat.toegestaan).toBe(false);
    expect(resultaat.blokkades).toContain('Staginglaag ontbreekt.');
    expect(resultaat.blokkades).toContain('BAG-geometrieën moeten in RD New (SRID 28992) worden opgeslagen.');
  });
});
