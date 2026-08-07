import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/bag-amsterdam-shadow-resumable-publication.yml', 'utf8');
const script = readFileSync('scripts/bag/run-amsterdam-shadow-resumable-publication.sh', 'utf8');

describe('Amsterdam publication writer', () => {
  it('is uitsluitend handmatig en vereist een nieuwe exacte publication approval', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('PUBLISH_BAG_AMSTERDAM_ARTIFACT_8973886061_TO_SHADOW');
    expect(script).toContain('APPROVAL_PHRASE="PUBLISH_BAG_AMSTERDAM_ARTIFACT_8973886061_TO_SHADOW"');
  });

  it('sluit productie en CRM-shadow hard uit en richt zich alleen op Amsterdam dataset 2', () => {
    expect(script).toContain('EXPECTED_SHADOW_REF="xfygspvpeugxowxbcvnm"');
    expect(script).toContain('PRODUCTION_REF="ljudxyrqoifhfikueric"');
    expect(script).toContain('CRM_SHADOW_REF="wzkhmjuasyuvzhhycnym"');
    expect(script).toContain('DATASET_ID=2');
    expect(script).toContain('DATASET_VERSION="v20260805"');
    expect(script).toContain('SCOPE_CODE="0363"');
  });

  it('herhaalt vóór elke write een hard read-only capaciteits-preflight', () => {
    expect(workflow).toContain('Herhaal read-only publication preflight');
    expect(workflow).toContain('CHECK_BAG_AMSTERDAM_PUBLICATION_PREFLIGHT_8973886061');
    expect(workflow).toContain('PGOPTIONS: -c default_transaction_read_only=on');
    expect(workflow).toContain('run-amsterdam-shadow-publication-preflight.sh');
  });

  it('publiceert gefaseerd en resumable zonder activatiecode', () => {
    for (const phase of ['objecten', 'voorkomens', 'relaties', 'geometrieen', 'validate']) {
      expect(workflow).toContain(`- ${phase}`);
    }
    expect(script).toContain('run_phase objecten');
    expect(script).toContain('run_phase voorkomens');
    expect(script).toContain('run_phase relaties');
    expect(script).toContain('run_phase geometrieen');
    expect(script).toContain('AMSTERDAM_RESUMABLE_PUBLICATION_PHASE_OK');
    expect(script).not.toMatch(/UPDATE\s+bag_control\.datasetversies/i);
    expect(script).not.toContain("status = 'actief'");
    expect(script).not.toContain('geactiveerd_op');
  });

  it('bewaakt fasevolgorde, exacte aantallen en quarantainereconciliatie', () => {
    expect(script).toContain('EXPECTED_OBJECTEN=1464429');
    expect(script).toContain('EXPECTED_VOORKOMENS=2664890');
    expect(script).toContain('EXPECTED_RELATIES=2531300');
    expect(script).toContain('EXPECTED_GEOMETRIEEN=1830704');
    expect(script).toContain('EXPECTED_GEOMETRIE_AFWIJKINGEN=1016');
    expect(script).toContain('assert_phase_order');
    expect(script).toContain("scope_code='0106' AND status='actief' AND is_actief");
    expect(script).toContain("scope_code='0363' AND is_actief");
  });

  it('valideert na publicatie inhoudelijke staging/published-pariteit en laat Amsterdam inactief', () => {
    expect(script).toContain('objecten_mismatch');
    expect(script).toContain('voorkomens_mismatch');
    expect(script).toContain('relaties_mismatch');
    expect(script).toContain('geometrieen_mismatch');
    expect(script).toContain('extensions.st_equals(p.geometrie, s.geometrie)');
    expect(script).toContain("grep -q $'^amsterdam_actief\\t0$'");
    expect(script).toContain('Activation performed: false');
  });

  it('gebruikt kleinere geometriechunks en laat slechts één publication-run tegelijk toe', () => {
    expect(workflow).toContain("github.event.inputs.phase == 'geometrieen' && '5000' || '50000'");
    expect(workflow).toContain('group: bag-amsterdam-shadow-resumable-publication');
    expect(workflow).toContain('cancel-in-progress: false');
  });
});
