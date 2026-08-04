import { describe, expect, it } from 'vitest';
import {
  AMSTERDAM_IMPORT_STAPPEN,
  beoordeelImportRunVeiligheid,
  bepaalVolgendeImportStap,
  kanPublicerenNaImport,
  maakBagShadowImportRun,
} from './importExecution';

function maakRun() {
  return maakBagShadowImportRun({
    runId: 'ams-2026-08-04-001',
    scopeCode: '0363',
    datasetVersie: '0363:2026-08-04:abc',
    doelProjectRef: 'xfygspvpeugxowxbcvnm',
    gestartOp: '2026-08-04T08:00:00Z',
  });
}

describe('Amsterdam shadowimport-uitvoercontract', () => {
  it('maakt een deterministische reeks uitvoerstappen', () => {
    const run = maakRun();
    expect(run.stappen.map(stap => stap.sleutel)).toEqual(AMSTERDAM_IMPORT_STAPPEN);
    expect(bepaalVolgendeImportStap(run)?.sleutel).toBe('bronpakket_valideren');
  });

  it('blokkeert actieve allowlists tijdens import', () => {
    const run = maakRun();
    run.clientAllowlistActief = true;
    expect(beoordeelImportRunVeiligheid(run).veilig).toBe(false);
  });

  it('blokkeert destructieve stappen zonder rollbackmarker', () => {
    const run = maakRun();
    run.stappen.find(stap => stap.sleutel === 'staging_legen')!.status = 'bezig';
    expect(beoordeelImportRunVeiligheid(run).blokkades).toContain(
      'Destructieve importstappen vereisen een geslaagde rollbackmarker.',
    );
  });

  it('staat publicatie pas toe na alle vereiste controles', () => {
    const run = maakRun();
    run.rollbackMarkerAanwezig = true;
    const verplicht = new Set([
      'bronpakket_valideren',
      'capaciteit_controleren',
      'rollbackmarker_vastleggen',
      'objecten_importeren',
      'voorkomens_importeren',
      'relaties_importeren',
      'geometrieen_importeren',
      'integriteit_valideren',
      'queryservice_rooktest',
    ]);
    run.stappen.forEach(stap => {
      if (verplicht.has(stap.sleutel)) stap.status = 'geslaagd';
    });
    expect(kanPublicerenNaImport(run)).toBe(true);
  });
});
