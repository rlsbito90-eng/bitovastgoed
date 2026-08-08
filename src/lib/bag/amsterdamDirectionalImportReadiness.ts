export const AMSTERDAM_DIRECTIONAL_FULL_SUBSET_CONTRACT = 'bag-amsterdam-directional-full-subset/3';
export const AMSTERDAM_DIRECTIONAL_BRON_SHA256 = '8f03782321490b113389df0bf215445bfa5c670b8f811bb7798ea8621c5b1007';

export interface AmsterdamDirectionalFullSubsetBewijs {
  status: string;
  contractversie: string;
  metadata_schema_version: number;
  bron_sha256: string;
  selectiebestand_sha256: string;
  geselecteerde_unieke_sleutels: number;
  records_geschreven: number;
  ontbrekende_geselecteerde_sleutels: number;
  parse_fouten: unknown[];
  output_sha256: string;
  database_write_uitgevoerd: boolean;
  supabase_benaderd: boolean;
  productie_benaderd: boolean;
}

export interface AmsterdamDirectionalImportReadiness {
  standrecords: number;
  uniekeSleutels: number;
  selectieChecksum: string;
  bronSha256: string;
  fullSubsetSha256: string;
}

/**
 * Fail-closed poort tussen de directionele v3 full-subset en importpakketgeneratie.
 * Voert geen I/O of databasehandeling uit.
 */
export function valideerAmsterdamDirectionalImportReadiness(
  bewijs: AmsterdamDirectionalFullSubsetBewijs,
  gemetenFullSubsetSha256: string,
): AmsterdamDirectionalImportReadiness {
  if (bewijs.status !== 'amsterdam_directional_full_subset_validated') {
    throw new Error(`Full-subset niet groen: ${bewijs.status}`);
  }
  if (bewijs.contractversie !== AMSTERDAM_DIRECTIONAL_FULL_SUBSET_CONTRACT) {
    throw new Error(`Onverwacht full-subsetcontract: ${bewijs.contractversie}`);
  }
  if (bewijs.metadata_schema_version !== 3) {
    throw new Error(`Onverwachte metadata-schemaversie: ${bewijs.metadata_schema_version}`);
  }
  if (bewijs.bron_sha256 !== AMSTERDAM_DIRECTIONAL_BRON_SHA256) {
    throw new Error(`Bronhash wijkt af: ${bewijs.bron_sha256}`);
  }
  if (bewijs.output_sha256 !== gemetenFullSubsetSha256) {
    throw new Error(`Full-subsethash wijkt af: ${gemetenFullSubsetSha256} != ${bewijs.output_sha256}`);
  }
  if (!Number.isInteger(bewijs.geselecteerde_unieke_sleutels) || bewijs.geselecteerde_unieke_sleutels <= 0) {
    throw new Error('Geen geldige telling unieke directionele sleutels.');
  }
  if (!Number.isInteger(bewijs.records_geschreven) || bewijs.records_geschreven <= 0) {
    throw new Error('Geen geldige standrecordtelling.');
  }
  if (bewijs.records_geschreven < bewijs.geselecteerde_unieke_sleutels) {
    throw new Error('Minder standrecords dan unieke geselecteerde sleutels.');
  }
  if (bewijs.ontbrekende_geselecteerde_sleutels !== 0) {
    throw new Error(`${bewijs.ontbrekende_geselecteerde_sleutels} geselecteerde sleutels ontbreken.`);
  }
  if (!Array.isArray(bewijs.parse_fouten) || bewijs.parse_fouten.length !== 0) {
    throw new Error('Full-subset bevat parsefouten.');
  }
  if (bewijs.database_write_uitgevoerd || bewijs.supabase_benaderd || bewijs.productie_benaderd) {
    throw new Error('Safety flags van full-subsetbewijs zijn niet schoon.');
  }
  if (!/^[a-f0-9]{64}$/.test(bewijs.selectiebestand_sha256)) {
    throw new Error('Selectiechecksum is ongeldig.');
  }

  return {
    standrecords: bewijs.records_geschreven,
    uniekeSleutels: bewijs.geselecteerde_unieke_sleutels,
    selectieChecksum: bewijs.selectiebestand_sha256,
    bronSha256: bewijs.bron_sha256,
    fullSubsetSha256: bewijs.output_sha256,
  };
}
