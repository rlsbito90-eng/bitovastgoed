import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const script = readFileSync('scripts/bag/run-amsterdam-shadow-publication-preflight.sh', 'utf-8');
const workflow = readFileSync('.github/workflows/bag-amsterdam-shadow-publication-preflight.yml', 'utf-8');

describe('Amsterdam publication preflight', () => {
  it('is hard begrensd tot het BAG-shadowproject en de gevalideerde Amsterdam-dataset', () => {
    expect(script).toContain('xfygspvpeugxowxbcvnm');
    expect(script).toContain('ljudxyrqoifhfikueric');
    expect(script).toContain('wzkhmjuasyuvzhhycnym');
    expect(script).toContain('CHECK_BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_8973886061');
    expect(script).toContain('DATASET_ID=2');
    expect(script).toContain('DATASET_VERSION="v20260805"');
    expect(script).toContain('SCOPE_CODE="0363"');
    expect(script).toContain("gevalideerd\\tf");
  });

  it('reconcilieert geldige geometrieen plus quarantaine naar alle brongeometrieen', () => {
    expect(script).toContain('EXPECTED_GEOMETRIEEN_VALID=1830704');
    expect(script).toContain('EXPECTED_GEOMETRIE_AFWIJKINGEN=1016');
    expect(script).toContain('EXPECTED_GEOMETRIEEN_BRON=1831720');
    expect(script).toContain('valid_geom + invalid_geom');
  });

  it('accepteert resumable publication-voortgang maar bewaakt prefixvolgorde en Assen', () => {
    expect(script).toContain('published_objecten <= EXPECTED_OBJECTEN');
    expect(script).toContain('published_voorkomens <= EXPECTED_VOORKOMENS');
    expect(script).toContain('published_relaties <= EXPECTED_RELATIES');
    expect(script).toContain('published_geometrieen <= EXPECTED_GEOMETRIEEN_VALID');
    expect(script).toContain('published_voorkomens > 0');
    expect(script).toContain('published_objecten == EXPECTED_OBJECTEN');
    expect(script).toContain('published_relaties > 0');
    expect(script).toContain('published_voorkomens == EXPECTED_VOORKOMENS');
    expect(script).toContain('published_geometrieen > 0');
    expect(script).toContain('published_relaties == EXPECTED_RELATIES');
    expect(script).toContain("assen_actief\\t1");
  });

  it('berekent capaciteit alleen voor nog resterende publicatierijen', () => {
    expect(script).toContain('remaining_objecten=$((EXPECTED_OBJECTEN - published_objecten))');
    expect(script).toContain('remaining_voorkomens=$((EXPECTED_VOORKOMENS - published_voorkomens))');
    expect(script).toContain('remaining_relaties=$((EXPECTED_RELATIES - published_relaties))');
    expect(script).toContain('remaining_geometrieen=$((EXPECTED_GEOMETRIEEN_VALID - published_geometrieen))');
    expect(script).toContain('SAFETY_FACTOR_PERCENT=125');
    expect(script).toContain('MIN_HEADROOM_BYTES=$((1024 * 1024 * 1024))');
    expect(script).toContain('NO_GO_CAPACITY');
    expect(script).toContain('required_capacity_bytes <= disk_cap_bytes');
  });

  it('forceert de workflow databasebreed read-only en bevat geen publicatie- of activatiefase', () => {
    expect(workflow).toContain('PGOPTIONS: -c default_transaction_read_only=on');
    expect(workflow).toContain("test \"$PGOPTIONS\" = '-c default_transaction_read_only=on'");
    expect(workflow).not.toContain('PUBLISH_BAG_AMSTERDAM');
    expect(workflow).not.toContain('activeer_datasetversie');
  });

  it('bevat geen database-write statements in het preflight-script', () => {
    const sqlWrites = /\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i;
    expect(script).not.toMatch(sqlWrites);
  });
});
