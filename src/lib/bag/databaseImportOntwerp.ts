export type BagDatabaseLaag = 'staging' | 'published' | 'quarantaine';

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
  versie: '2A.3A';
  srid: 28992;
  voorkomen: {
    technischeSleutel: readonly ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'];
    officieelBronveld: 'voorkomenidentificatie';
    officieelBronveldIndexeerbaar: true;
  };
  geometrie: {
    opslagtype: 'geometry(GeometryZ,28992)';
    dimensies: 3;
    toegestaneVormen: readonly ['POINT', 'POLYGON'];
    automatischeCorrectieToegestaan: false;
    semantischeKoppeling: {
      koppelsleutel: readonly ['objecttype', 'identificatie', 'voorkomen_sleutel'];
      eersteKandidaatAutomatischToegestaan: false;
      statusBijMeerdereKandidaten: 'geblokkeerd_zonder_onderscheidende_bronmetadata';
      benodigdeBronmetadata: readonly ['begin_geldigheid', 'eind_geldigheid', 'tijdstip_registratie', 'eind_registratie'];
    };
    quarantaine: {
      tabel: 'bag_geometrie_afwijkingen';
      verplichteVelden: readonly [
        'datasetversie_id',
        'objecttype',
        'identificatie',
        'voorkomen_sleutel',
        'voorkomenidentificatie',
        'geometrie_volgnummer',
        'reden',
        'wkt',
      ];
    };
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
    voorkomens: 'datasetversie_objecttype_identificatie_voorkomen_sleutel';
    relaties: 'datasetversie_bron_relatietype_doel';
    geometrieen: 'datasetversie_objecttype_identificatie_voorkomen_sleutel_geometrie_volgnummer';
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
  versie: '2A.3A',
  srid: 28992,
  voorkomen: {
    technischeSleutel: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'],
    officieelBronveld: 'voorkomenidentificatie',
    officieelBronveldIndexeerbaar: true,
  },
  geometrie: {
    opslagtype: 'geometry(GeometryZ,28992)',
    dimensies: 3,
    toegestaneVormen: ['POINT', 'POLYGON'],
    automatischeCorrectieToegestaan: false,
    semantischeKoppeling: {
      koppelsleutel: ['objecttype', 'identificatie', 'voorkomen_sleutel'],
      eersteKandidaatAutomatischToegestaan: false,
      statusBijMeerdereKandidaten: 'geblokkeerd_zonder_onderscheidende_bronmetadata',
      benodigdeBronmetadata: ['begin_geldigheid', 'eind_geldigheid', 'tijdstip_registratie', 'eind_registratie'],
    },
    quarantaine: {
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
    },
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
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel']],
      [
        { naam: 'bag_staging_voorkomens_bron_id_idx', kolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'], type: 'btree', uniek: false },
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
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel', 'geometrie_volgnummer'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel', 'geometrie_volgnummer']],
      [
        { naam: 'bag_staging_geometrieen_gist_idx', kolommen: ['geometrie'], type: 'gist', uniek: false },
        { naam: 'bag_staging_geometrieen_object_idx', kolommen: ['objecttype', 'identificatie'], type: 'btree', uniek: false },
      ],
      [{ kolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'], doelTabel: 'bag_staging_voorkomens', doelKolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'], uitgesteldValideerbaar: false }],
    ),
    tabel(
      'bag_geometrie_afwijkingen',
      'quarantaine',
      'Bewaart ongewijzigde brongeometrieën die niet valide zijn; automatische geometriecorrectie is niet toegestaan.',
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel', 'geometrie_volgnummer'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel', 'geometrie_volgnummer']],
      [{ naam: 'bag_geometrie_afwijkingen_bron_idx', kolommen: ['objecttype', 'identificatie', 'voorkomenidentificatie'], type: 'btree', uniek: false }],
      [{ kolommen: ['datasetversie_id'], doelTabel: 'bag_datasetversies', doelKolommen: ['id'], uitgesteldValideerbaar: false }],
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
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel']],
      [
        { naam: 'bag_voorkomens_bron_id_idx', kolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomenidentificatie'], type: 'btree', uniek: false },
        { naam: 'bag_voorkomens_actueel_idx', kolommen: ['datasetversie_id', 'objecttype', 'is_actueel'], type: 'btree', uniek: false },
      ],
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
      ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel', 'geometrie_volgnummer'],
      [['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel', 'geometrie_volgnummer']],
      [{ naam: 'bag_geometrieen_gist_idx', kolommen: ['geometrie'], type: 'gist', uniek: false }],
      [{ kolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'], doelTabel: 'bag_voorkomens', doelKolommen: ['datasetversie_id', 'objecttype', 'identificatie', 'voorkomen_sleutel'], uitgesteldValideerbaar: false }],
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
      'bag_geometrie_afwijkingen',
      'validatie',
      'kopieer_naar_published',
      'activeer_datasetversie_atomisch',
    ],
    vorigeVersieBewaren: true,
    crmSchrijfactiesToegestaan: false,
  },
  upsert: {
    objecten: 'datasetversie_objecttype_identificatie',
    voorkomens: 'datasetversie_objecttype_identificatie_voorkomen_sleutel',
    relaties: 'datasetversie_bron_relatietype_doel',
    geometrieen: 'datasetversie_objecttype_identificatie_voorkomen_sleutel_geometrie_volgnummer',
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
  if (!ontwerp.tabellen.some(item => item.laag === 'quarantaine')) blokkades.push('Geometriequarantaine ontbreekt.');
  if (ontwerp.srid !== 28992) blokkades.push('BAG-geometrieën moeten in RD New (SRID 28992) worden opgeslagen.');
  if (ontwerp.geometrie.opslagtype !== 'geometry(GeometryZ,28992)' || ontwerp.geometrie.dimensies !== 3) {
    blokkades.push('BAG-geometrieën moeten als driedimensionale GeometryZ in SRID 28992 worden opgeslagen.');
  }
  if (ontwerp.geometrie.automatischeCorrectieToegestaan) blokkades.push('Automatische geometriecorrectie is niet toegestaan.');
  if (ontwerp.geometrie.semantischeKoppeling.eersteKandidaatAutomatischToegestaan) {
    blokkades.push('Een geometrie mag bij meerdere voorkomenkandidaten niet automatisch aan de eerste kandidaat worden gekoppeld.');
  }
  if (!ontwerp.publicatie.vorigeVersieBewaren) blokkades.push('Vorige datasetversie moet voor rollback behouden blijven.');
  if (ontwerp.publicatie.crmSchrijfactiesToegestaan !== false) blokkades.push('BAG-import mag geen CRM-schrijfacties toestaan.');

  for (const item of ontwerp.tabellen) {
    if (!item.primaireSleutel.length) blokkades.push(`${item.naam} heeft geen primaire sleutel.`);
    if (item.laag !== 'quarantaine' && item.naam.includes('geometrie') && !item.indexen.some(index => index.type === 'gist')) {
      blokkades.push(`${item.naam} mist een GiST-index.`);
    }
  }

  return { toegestaan: blokkades.length === 0, blokkades };
}
