export type BagDatabaseLaag = 'staging' | 'published';

export type BagDatabaseObjecttype =
  | 'Pand'
  | 'Verblijfsobject'
  | 'Nummeraanduiding'
  | 'OpenbareRuimte'
  | 'Woonplaats'
  | 'Standplaats'
  | 'Ligplaats';

export interface BagDatabaseTabelOntwerp {
  naam: string;
  laag: BagDatabaseLaag;
  doel: string;
  primaireSleutel: string[];
  uniekeSleutels: string[][];
  foreignKeys: Array<{
    kolommen: string[];
    doelTabel: string;
    doelKolommen: string[];
    uitgesteldValideerbaar: boolean;
  }>;
  indexen: Array<{
    naam: string;
    kolommen: string[];
    type: 'btree' | 'gist';
    uniek: boolean;
  }>;
}

export interface BagDatabaseImportOntwerp {
  versie: '2A.1-L';
  srid: 28992;
  geometrieTypes: {
    punt: 'geometry(PointZ,28992)';
    polygoon: 'geometry(PolygonZ,28992)';
  };
  tabellen: BagDatabaseTabelOntwerp[];
  publicatie: {
    strategie: 'datasetversie_omschakeling';
    schrijfvolgorde: string[];
    vorigeVersieBewaren: true;
    crmSchrijfactiesToegestaan: false;
  };
  upsert: {
    objecten: 'datasetversie_objecttype_identificatie';
    voorkomens: 'datasetversie_objecttype_identificatie_voorkomenidentificatie';
    relaties: 'datasetversie_bron_relatietype_doel';
    geometrieen: 'datasetversie_objecttype_identificatie_voorkomenidentificatie';
  };
}

const tabel = (
  naam: string,
  laag: BagDatabaseLaag,
  doel: string,
  primaireSleutel: string[],
  uniekeSleutels: string[][],
  indexen: BagDatabaseTabelOntwerp['indexen'],
  foreignKeys: BagDatabaseTabelOntwerp['foreignKeys'] = [],
): BagDatabaseTabelOntwerp => ({ naam, laag, doel, primaireSleutel, uniekeSleutels, indexen, foreignKeys });

export const BAG_DATABASE_IMPORT_ONTWERP: BagDatabaseImportOntwerp = {
  versie: '2A.1-L',
  srid: 28992,
  geometrieTypes: {
    punt: 'geometry(PointZ,28992)',
    polygoon: 'geometry(PolygonZ,28992)',
  },
  tabellen: [
    tabel(
      'bag_datasetversies',
      'published',
      'Beheert datasetstatus, bronchecksum, scope en atomische activering.',
      ['id'],
      [['datasetversie', 'scope_code']],
      [
        { naam: 'bag_datasetversies_status_idx', kolommen: ['status'], type: 'btree', uniek: false },
        { naam: 'bag_datasetversies_actief_idx', kolommen: ['scope_code', 'is_actief'], type: 'btree', uniek: false },
      ],
    ),
    tabel(
      'bag_staging_objecten',
      'staging',
      'Bevat één objectkop per datasetversie en BAG-identificatie.',
      ['datasetversie_id', 'objecttype', 'identificatie'],
      [['datasetversie_id', 'objecttype', 'identificatie']],
      [{ naam: 'bag_staging_objecten_identificatie_idx', kolommen: ['objecttype', 'identificatie'], type: 'btree', uniek: false }],
      [{ kolommen: ['datasetversie_id'], doelTabel: 'bag_datasetversies', doelKolommen: ['id'], uitgesteldValideerbaar: false }],
    ),
    tabel(
      'bag_staging_voorkomens',
      'staging',
      'Bewaart alle historische en actuele voorkomens append-only binnen een datasetversie.',
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie']],
      [
        { naam: 'bag_staging_voorkomens_actueel_idx', kolommen: ['datasetversie_id', 'objecttype', 'is_actueel'], type: 'btree', uniek: false },
        { naam: 'bag_staging_voorkomens_geldigheid_idx', kolommen: ['begin_geldigheid', 'eind_geldigheid'], type: 'btree', uniek: false },
      ],
      [{ kolommen: ['datasetversie_id', 'objecttype', 'identificatie'], doelTabel: 'bag_staging_objecten', doelKolommen: ['datasetversie_id', 'objecttype', 'identificatie'], uitgesteldValideerbaar: false }],
    ),
    tabel(
      'bag_staging_relaties',
      'staging',
      'Bewaart gededupliceerde BAG-relaties zonder stille verwijdering van nog niet opgeloste doelen.',
      ['datasetversie_id', 'bron_objecttype', 'bron_identificatie', 'relatietype', 'doel_identificatie'],
      [['datasetversie_id', 'bron_objecttype', 'bron_identificatie', 'relatietype', 'doel_identificatie']],
      [
        { naam: 'bag_staging_relaties_bron_idx', kolommen: ['bron_objecttype', 'bron_identificatie'], type: 'btree', uniek: false },
        { naam: 'bag_staging_relaties_doel_idx', kolommen: ['doel_identificatie'], type: 'btree', uniek: false },
      ],
      [{ kolommen: ['datasetversie_id', 'bron_objecttype', 'bron_identificatie'], doelTabel: 'bag_staging_objecten', doelKolommen: ['datasetversie_id', 'objecttype', 'identificatie'], uitgesteldValideerbaar: false }],
    ),
    tabel(
      'bag_staging_geometrieen',
      'staging',
      'Bewaart RD-geometrieën per voorkomen met expliciete dimensie en vorm.',
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie']],
      [
        { naam: 'bag_staging_geometrieen_gist_idx', kolommen: ['geometrie'], type: 'gist', uniek: false },
        { naam: 'bag_staging_geometrieen_object_idx', kolommen: ['objecttype', 'identificatie'], type: 'btree', uniek: false },
      ],
      [{ kolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'], doelTabel: 'bag_staging_voorkomens', doelKolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'], uitgesteldValideerbaar: false }],
    ),
    tabel(
      'bag_objecten',
      'published',
      'Publiceerbare objectkoppen van uitsluitend de actieve datasetversie.',
      ['datasetversie_id', 'objecttype', 'identificatie'],
      [['datasetversie_id', 'objecttype', 'identificatie']],
      [{ naam: 'bag_objecten_lookup_idx', kolommen: ['objecttype', 'identificatie'], type: 'btree', uniek: false }],
    ),
    tabel(
      'bag_voorkomens',
      'published',
      'Publiceerbare historische en actuele voorkomens.',
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie']],
      [{ naam: 'bag_voorkomens_actueel_idx', kolommen: ['datasetversie_id', 'objecttype', 'is_actueel'], type: 'btree', uniek: false }],
    ),
    tabel(
      'bag_relaties',
      'published',
      'Publiceerbare relaties voor adres-, pand- en verblfsobjectnavigatie.',
      ['datasetversie_id', 'bron_objecttype', 'bron_identificatie', 'relatietype', 'doel_identificatie'],
      [['datasetversie_id', 'bron_objecttype', 'bron_identificatie', 'relatietype', 'doel_identificatie']],
      [
        { naam: 'bag_relaties_bron_idx', kolommen: ['bron_objecttype', 'bron_identificatie'], type: 'btree', uniek: false },
        { naam: 'bag_relaties_doel_idx', kolommen: ['doel_identificatie'], type: 'btree', uniek: false },
      ],
    ),
    tabel(
      'bag_geometrieen',
      'published',
      'Publiceerbare ruimtelijke laag voor kaart- en gebiedsquery’s.',
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie']],
      [{ naam: 'bag_geometrieen_gist_idx', kolommen: ['geometrie'], type: 'gist', uniek: false }],
    ),
  ],
  publicatie: {
    strategie: 'datasetversie_omschakeling',
    schrijfvolgorde: [
      'bag_datasetversies',
      'bag_staging_objecten',
      'bag_staging_voorkomens',
      'bag_staging_relaties',
      'bag_staging_geometrieen',
      'validatie',
      'kopieer_naar_published',
      'activeer_datasetversie_atomisch',
    ],
    vorigeVersieBewaren: true,
    crmSchrijfactiesToegestaan: false,
  },
  upsert: {
    objecten: 'datasetversie_objecttype_identificatie',
    voorkomens: 'datasetversie_objecttype_identificatie_voorkomenidentificatie',
    relaties: 'datasetversie_bron_relatietype_doel',
    geometrieen: 'datasetversie_objecttype_identificatie_voorkomenidentificatie',
  },
};

export interface BagDatabaseOntwerpBesluit {
  toegestaan: boolean;
  blokkades: string[];
}

export function valideerBagDatabaseImportOntwerp(
  ontwerp: BagDatabaseImportOntwerp = BAG_DATABASE_IMPORT_ONTWERP,
): BagDatabaseOntwerpBesluit {
  const blokkades: string[] = [];
  const namen = ontwerp.tabellen.map(item => item.naam);

  if (new Set(namen).size !== namen.length) blokkades.push('Tabelnamen moeten uniek zijn.');
  if (!ontwerp.tabellen.some(item => item.laag === 'staging')) blokkades.push('Staginglaag ontbreekt.');
  if (!ontwerp.tabellen.some(item => item.laag === 'published')) blokkades.push('Published-laag ontbreekt.');
  if (ontwerp.srid !== 28992) blokkades.push('BAG-geometrieën moeten in RD New (SRID 28992) worden opgeslagen.');
  if (!ontwerp.publicatie.vorigeVersieBewaren) blokkades.push('Vorige datasetversie moet voor rollback behouden blijven.');
  if (ontwerp.publicatie.crmSchrijfactiesToegestaan !== false) blokkades.push('BAG-import mag geen CRM-schrijfacties toestaan.');

  for (const item of ontwerp.tabellen) {
    if (!item.primaireSleutel.length) blokkades.push(`${item.naam} heeft geen primaire sleutel.`);
    if (item.naam.includes('geometrie') && !item.indexen.some(index => index.type === 'gist')) {
      blokkades.push(`${item.naam} mist een GiST-index.`);
    }
  }

  return { toegestaan: blokkades.length === 0, blokkades };
}
