import { describe, expect, it } from 'vitest';
import {
  AMSTERDAM_DIRECTIONAL_BRON_SHA256,
  AMSTERDAM_DIRECTIONAL_FULL_SUBSET_CONTRACT,
  valideerAmsterdamDirectionalImportReadiness,
  type AmsterdamDirectionalFullSubsetBewijs,
} from './amsterdamDirectionalImportReadiness';

const HASH = 'a'.repeat(64);
const BASIS: AmsterdamDirectionalFullSubsetBewijs = {
  status: 'amsterdam_directional_full_subset_validated',
  contractversie: AMSTERDAM_DIRECTIONAL_FULL_SUBSET_CONTRACT,
  metadata_schema_version: 3,
  bron_sha256: AMSTERDAM_DIRECTIONAL_BRON_SHA256,
  selectiebestand_sha256: 'b'.repeat(64),
  geselecteerde_unieke_sleutels: 100,
  records_geschreven: 180,
  ontbrekende_geselecteerde_sleutels: 0,
  parse_fouten: [],
  output_sha256: HASH,
  database_write_uitgevoerd: false,
  supabase_benaderd: false,
  productie_benaderd: false,
};

describe('Amsterdam directionele import-readiness', () => {
  it('vertaalt groene v3-bewijslast naar standrecord-gebaseerde importmetadata', () => {
    const resultaat = valideerAmsterdamDirectionalImportReadiness(BASIS, HASH);
    expect(resultaat.standrecords).toBe(180);
    expect(resultaat.uniekeSleutels).toBe(100);
    expect(resultaat.selectieChecksum).toBe('b'.repeat(64));
  });

  it('blokkeert hashdrift, ontbrekende sleutels, parsefouten en safety drift', () => {
    expect(() => valideerAmsterdamDirectionalImportReadiness(BASIS, 'c'.repeat(64))).toThrow(/hash wijkt af/i);
    expect(() => valideerAmsterdamDirectionalImportReadiness({ ...BASIS, ontbrekende_geselecteerde_sleutels: 1 }, HASH)).toThrow(/ontbreken/i);
    expect(() => valideerAmsterdamDirectionalImportReadiness({ ...BASIS, parse_fouten: ['x'] }, HASH)).toThrow(/parsefouten/i);
    expect(() => valideerAmsterdamDirectionalImportReadiness({ ...BASIS, supabase_benaderd: true }, HASH)).toThrow(/safety/i);
  });

  it('blokkeert wanneer standrecords lager zijn dan het aantal unieke sleutels', () => {
    expect(() => valideerAmsterdamDirectionalImportReadiness({ ...BASIS, records_geschreven: 99 }, HASH)).toThrow(/minder standrecords/i);
  });
});
