export type BagImportRunStatus =
  | 'aangemaakt'
  | 'bron_geverifieerd'
  | 'uitpakken'
  | 'parsen'
  | 'staging_laden'
  | 'valideren'
  | 'klaar_voor_publicatie'
  | 'publiceren'
  | 'gepubliceerd'
  | 'mislukt'
  | 'teruggedraaid';

export type BagImportFase =
  | 'bron_verificatie'
  | 'uitpakken'
  | 'parsen'
  | 'staging_load'
  | 'validatie'
  | 'publicatie'
  | 'zoekindex'
  | 'ruimtelijke_koppeling';

export interface BagImportBron {
  bestandsnaam: string;
  datasetVersie: string;
  peildatum: string;
  checksumAlgoritme: 'sha256';
  verwachteChecksum: string;
  werkelijkeChecksum?: string | null;
  scopeType: 'gemeente';
  scopeCode: string;
  scopeNaam: string;
}

export interface BagImportCheckpoint {
  fase: BagImportFase;
  cursor: string | null;
  verwerkteRecords: number;
  geweigerdeRecords: number;
  voltooid: boolean;
  bijgewerktOp: string;
}

export interface BagImportAfwijzing {
  objectType: 'pand' | 'verblijfsobject' | 'nummeraanduiding' | 'openbare_ruimte' | 'woonplaats' | 'relatie';
  bronIdentificatie: string | null;
  redenCode:
    | 'ongeldige_identificatie'
    | 'ongeldige_geometrie'
    | 'ontbrekende_relatie'
    | 'buiten_scope'
    | 'schemafout'
    | 'duplicaat_conflict'
    | 'onbekend';
  toelichting: string;
}

export interface BagImportValidatie {
  checksumGeverifieerd: boolean;
  bronScopeGeverifieerd: boolean;
  tellingenSluiten: boolean;
  relatiesSluiten: boolean;
  geometrieGeldig: boolean;
  idempotentieGeverifieerd: boolean;
  stilleUitval: number;
  afwijzingen: BagImportAfwijzing[];
}

export interface BagPublicatiePlan {
  stagingDatasetVersie: string;
  huidigeActieveDatasetVersie: string | null;
  vorigeDatasetVersieBewaren: boolean;
  zoekindexOpnieuwOpbouwen: boolean;
  ruimtelijkeKoppelingOpnieuwOpbouwen: boolean;
  crmSchrijfactiesToegestaan: false;
}

export interface BagImportRun {
  id: string;
  status: BagImportRunStatus;
  bron: BagImportBron;
  checkpoints: BagImportCheckpoint[];
  validatie: BagImportValidatie | null;
  publicatiePlan: BagPublicatiePlan | null;
  gestartOp: string;
  afgerondOp: string | null;
  foutmelding: string | null;
}

export interface BagImportBesluit {
  toegestaan: boolean;
  fouten: string[];
}

const TOEGESTANE_OVERGANGEN: Record<BagImportRunStatus, BagImportRunStatus[]> = {
  aangemaakt: ['bron_geverifieerd', 'mislukt'],
  bron_geverifieerd: ['uitpakken', 'mislukt'],
  uitpakken: ['parsen', 'mislukt'],
  parsen: ['staging_laden', 'mislukt'],
  staging_laden: ['valideren', 'mislukt'],
  valideren: ['klaar_voor_publicatie', 'mislukt'],
  klaar_voor_publicatie: ['publiceren', 'mislukt'],
  publiceren: ['gepubliceerd', 'mislukt'],
  gepubliceerd: ['teruggedraaid'],
  mislukt: ['uitpakken', 'parsen', 'staging_laden', 'valideren'],
  teruggedraaid: [],
};

export function magStatusOvergang(van: BagImportRunStatus, naar: BagImportRunStatus): boolean {
  return TOEGESTANE_OVERGANGEN[van].includes(naar);
}

export function volgendeHervatbareFase(run: BagImportRun): BagImportFase | null {
  const volgorde: BagImportFase[] = [
    'bron_verificatie',
    'uitpakken',
    'parsen',
    'staging_load',
    'validatie',
    'publicatie',
    'zoekindex',
    'ruimtelijke_koppeling',
  ];

  for (const fase of volgorde) {
    const checkpoint = run.checkpoints.find(item => item.fase === fase);
    if (!checkpoint?.voltooid) return fase;
  }

  return null;
}

export function valideerPublicatie(run: BagImportRun): BagImportBesluit {
  const fouten: string[] = [];

  if (run.status !== 'klaar_voor_publicatie') {
    fouten.push('Alleen een gevalideerde import-run mag worden gepubliceerd.');
  }

  if (!run.validatie) {
    fouten.push('Validatieresultaten ontbreken.');
  } else {
    if (!run.validatie.checksumGeverifieerd) fouten.push('Bronchecksum is niet geverifieerd.');
    if (!run.validatie.bronScopeGeverifieerd) fouten.push('De gemeentelijke bronscope is niet geverifieerd.');
    if (!run.validatie.tellingenSluiten) fouten.push('Objecttellingen sluiten niet.');
    if (!run.validatie.relatiesSluiten) fouten.push('BAG-objectrelaties sluiten niet.');
    if (!run.validatie.geometrieGeldig) fouten.push('Eén of meer geometrieën zijn ongeldig.');
    if (!run.validatie.idempotentieGeverifieerd) fouten.push('Idempotentie is niet geverifieerd.');
    if (run.validatie.stilleUitval !== 0) fouten.push('Stille uitval is niet toegestaan.');
    if (run.validatie.afwijzingen.some(item => !item.toelichting.trim())) {
      fouten.push('Iedere afgewezen bronregel moet een toelichting hebben.');
    }
  }

  if (!run.publicatiePlan) {
    fouten.push('Publicatieplan ontbreekt.');
  } else {
    if (!run.publicatiePlan.vorigeDatasetVersieBewaren) {
      fouten.push('De vorige datasetversie moet voor rollback bewaard blijven.');
    }
    if (!run.publicatiePlan.zoekindexOpnieuwOpbouwen) {
      fouten.push('De zoekindex moet bij publicatie opnieuw worden opgebouwd.');
    }
    if (!run.publicatiePlan.ruimtelijkeKoppelingOpnieuwOpbouwen) {
      fouten.push('De ruimtelijke gebiedskoppeling moet bij publicatie opnieuw worden opgebouwd.');
    }
    if (run.publicatiePlan.crmSchrijfactiesToegestaan !== false) {
      fouten.push('BAG-publicatie mag geen CRM-schrijfacties uitvoeren.');
    }
  }

  return { toegestaan: fouten.length === 0, fouten };
}

export function valideerRollback(run: BagImportRun): BagImportBesluit {
  const fouten: string[] = [];

  if (run.status !== 'gepubliceerd') {
    fouten.push('Alleen een gepubliceerde dataset kan worden teruggedraaid.');
  }
  if (!run.publicatiePlan?.huidigeActieveDatasetVersie) {
    fouten.push('Er is geen vorige actieve datasetversie beschikbaar voor rollback.');
  }
  if (!run.publicatiePlan?.vorigeDatasetVersieBewaren) {
    fouten.push('De vorige datasetversie is niet als rollbackversie bewaard.');
  }

  return { toegestaan: fouten.length === 0, fouten };
}
