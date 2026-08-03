import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BAG_DATABASE_IMPORT_ONTWERP,
  valideerBagDatabaseImportOntwerp,
  type BagDatabaseImportOntwerp,
} from './databaseImportOntwerp';

const VOORKOMEN_SLEUTEL = ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'];
const GEOMETRIE_SLEUTEL = [...VOORKOMEN_SLEUTEL, 'geometrie_volgnummer'];

const leesRepositorybestand = (pad: string): string => readFileSync(resolve(process.cwd(), pad), 'utf-8');
const normaliseerSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const schemaSql = normaliseerSql(leesRepositorybestand('experiments/bag/2a2/schema.sql'));
const officieleAssenLoadSql = normaliseerSql(
  leesRepositorybestand('experiments/bag/2a2/load-officiele-assen.sql'),
);
const officieleAssenExporter = leesRepositorybestand('scripts/bag/exporteer-assen-naar-postgis-csv.ts');

describe('BAG database-importontwerp', () => {
  it('bevat gescheiden staging-, published- en quarantainelagen', () => {
    expect(BAG_DATABASE_IMPORT_ONTWERP.tabellen.some(item => item.laag === 'staging')).toBe(true);
    expect(BAG_DATABASE_IMPORT_ONTWERP.tabellen.some(item => item.laag === 'published')).toBe(true);
    expect(BAG_DATABASE_IMPORT_ONTWERP.tabellen.some(item => item.laag === 'quarantaine')).toBe(true);
    expect(BAG_DATABASE_IMPORT_ONTWERP.publicatie.strategie).toBe('datasetversie_omschakeling');
  });

  it('maakt voorkomen_sleutel canoniek en houdt de officiële voorkomen-ID indexeerbaar', () => {
    expect(BAG_DATABASE_IMPORT_ONTWERP.voorkomen).toEqual({
      technischeSleutel: VOORKOMEN_SLEUTEL,
      officieelBronveld: 'voorkomenidentificatie',
      officieelBronveldIndexeerbaar: true,
    });

    for (const naam of ['bag_staging_voorkomens', 'bag_voorkomens']) {
      const voorkomens = BAG_DATABASE_IMPORT_ONTWERP.tabellen.find(item => item.naam === naam);
      expect(voorkomens?.primaireSleutel).toEqual(VOORKOMEN_SLEUTEL);
      expect(
        voorkomens?.indexen.some(index => index.kolommen.includes('voorkomenidentificatie')),
      ).toBe(true);
    }

    expect(BAG_DATABASE_IMPORT_ONTWERP.upsert.voorkomens).toBe(
      'datasetversie_objecttype_identificatie_voorkomen_sleutel',
    );
  });

  it('koppelt iedere geometrie via voorkomen_sleutel en geometrie_volgnummer', () => {
    for (const naam of ['bag_staging_geometrieen', 'bag_geometrieen']) {
      const geometrieen = BAG_DATABASE_IMPORT_ONTWERP.tabellen.find(item => item.naam === naam);
      expect(geometrieen?.primaireSleutel).toEqual(GEOMETRIE_SLEUTEL);
      expect(geometrieen?.foreignKeys).toContainEqual(
        expect.objectContaining({ kolommen: VOORKOMEN_SLEUTEL }),
      );
    }

    expect(BAG_DATABASE_IMPORT_ONTWERP.upsert.geometrieen).toBe(
      'datasetversie_objecttype_identificatie_voorkomen_sleutel_geometrie_volgnummer',
    );
  });

  it('gebruikt driedimensionale RD New GeometryZ met POINT/POLYGON en GiST', () => {
    expect(BAG_DATABASE_IMPORT_ONTWERP.srid).toBe(28992);
    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrie.opslagtype).toBe('geometry(GeometryZ,28992)');
    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrie.dimensies).toBe(3);
    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrie.toegestaneVormen).toEqual(['POINT', 'POLYGON']);

    for (const tabel of BAG_DATABASE_IMPORT_ONTWERP.tabellen.filter(
      item => item.laag !== 'quarantaine' && item.naam.includes('geometrie'),
    )) {
      expect(tabel.indexen.some(index => index.type === 'gist')).toBe(true);
    }
  });

  it('neemt controleerbare geometriequarantaine op zonder automatische correctie', () => {
    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrie.automatischeCorrectieToegestaan).toBe(false);
    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrie.quarantaine).toEqual({
      tabel: 'bag_geometrie_afwijkingen',
      verplichteVelden: [
        'datasetversie_id',
        'objecttype',
        'identificatie',
        'voorkomen_sleutel',
        'voorkomenidentificatie',
        'geometrie_volgnummer',
        'reden',
        'wkt',
      ],
    });
  });

  it('detecteert sleutel- en geometriedrift met het bewezen 2A.2-schema', () => {
    expect(schemaSql).toContain(
      'primary key (datasetversie_id, objecttype, identificatie, voorkomen_sleutel)',
    );
    expect(schemaSql).toContain(
      'create index voorkomens_bron_id_idx on voorkomens (datasetversie_id, objecttype, identificatie, voorkomenidentificatie)',
    );
    expect(schemaSql).toContain('geometrie geometry(geometryz, 28992) not null');
    expect(schemaSql).toContain(
      'primary key (datasetversie_id, objecttype, identificatie, voorkomen_sleutel, geometrie_volgnummer)',
    );
    expect(schemaSql).toContain(
      'foreign key (datasetversie_id, objecttype, identificatie, voorkomen_sleutel)',
    );
    expect(schemaSql).toContain('check (st_srid(geometrie) = 28992)');
    expect(schemaSql).toContain('check (st_ndims(geometrie) = 3)');
    expect(schemaSql).toContain("check (geometrytype(geometrie) in ('point', 'polygon'))");
    expect(schemaSql).toContain('using gist (geometrie)');
  });

  it('detecteert drift met de officiële Assen-load en haar quarantainepad', () => {
    expect(officieleAssenLoadSql).toContain(
      'create unlogged table raw_geometrieen ( objecttype text not null, identificatie text not null, voorkomen_sleutel text not null, voorkomenidentificatie integer not null, geometrie_volgnummer integer not null, wkt text not null )',
    );
    expect(officieleAssenLoadSql).toContain(
      'create table geometrie_afwijkingen ( datasetversie_id bigint not null references datasetversies(id) on delete cascade, objecttype text not null, identificatie text not null, voorkomen_sleutel text not null, voorkomenidentificatie integer not null, geometrie_volgnummer integer not null, reden text not null, wkt text not null',
    );
    expect(officieleAssenLoadSql).toContain('st_isvalidreason(geometrie)');
    expect(officieleAssenLoadSql).toContain('where not st_isvalid(geometrie)');
    expect(officieleAssenLoadSql).not.toContain('st_makevalid');
  });

  it('blokkeert semantisch ambigue geometriekoppeling bij dubbele officiële voorkomen-ID’s', () => {
    const geometrieKoppelcode = officieleAssenExporter.slice(
      officieleAssenExporter.indexOf('for (const item of staging.geometrieen)'),
      officieleAssenExporter.indexOf("writeFileSync(resolve(outputDir, 'geometrieen.csv')"),
    );

    expect(BAG_DATABASE_IMPORT_ONTWERP.geometrie.semantischeKoppeling).toEqual({
      koppelsleutel: ['objecttype', 'identificatie', 'voorkomen_sleutel'],
      eersteKandidaatAutomatischToegestaan: false,
      statusBijMeerdereKandidaten: 'geblokkeerd_zonder_onderscheidende_bronmetadata',
      benodigdeBronmetadata: [
        'begin_geldigheid',
        'eind_geldigheid',
        'tijdstip_registratie',
        'eind_registratie',
      ],
    });

    expect(geometrieKoppelcode).toContain(
      'const voorkomen_sleutel = mogelijkeVoorkomenSleutels?.[0];',
    );
    expect(geometrieKoppelcode).not.toMatch(
      /item\.(beginGeldigheid|eindGeldigheid|tijdstipRegistratie|eindRegistratie)/,
    );
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
