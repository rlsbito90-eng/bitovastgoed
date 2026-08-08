import { describe, expect, it } from 'vitest';

import type { AcquisitieNaPostProjectie } from './acquisitieNaPostProjectie';
import { bouwAcquisitieNaPostDossierPlan } from './acquisitieNaPostDossierPlan';

function projectie(
  werkbak: AcquisitieNaPostProjectie['werkbak'],
  opvolgenOp: string | null,
): AcquisitieNaPostProjectie {
  return {
    batchId: 'batch-1',
    totaalBriefversies: 2,
    succesvolGepost: werkbak === 'geprint_posten' ? 1 : 2,
    postregistratieMislukt: werkbak === 'geprint_posten' ? 1 : 0,
    opvolgtakenGeslaagd: werkbak === 'geprint_posten' ? 1 : 2,
    opvolgtakenMislukt: 0,
    retryPostNodig: werkbak === 'geprint_posten',
    retryOpvolgingNodig: false,
    werkbak,
    werkbakReden: 'reden',
    opvolgenOp,
  };
}

describe('bouwAcquisitieNaPostDossierPlan', () => {
  it('houdt een gedeeltelijk geposte selectie in Geprint / posten', () => {
    expect(bouwAcquisitieNaPostDossierPlan({
      selectieId: ' selectie-1 ',
      projectie: projectie('geprint_posten', null),
      actorId: ' actor-1 ',
      operationKey: ' dossier:batch-1 ',
    })).toEqual({
      selectieId: 'selectie-1',
      primaireWerkbak: 'geprint_posten',
      volgendeActieOp: null,
      volgendeActieOmschrijving: 'Rond de resterende postregistraties af.',
      actorId: 'actor-1',
      operationKey: 'dossier:batch-1',
    });
  });

  it('projecteert volledig gepost naar wachten of opvolgen met datum', () => {
    const datum = '2026-08-20T10:00:00.000Z';
    expect(bouwAcquisitieNaPostDossierPlan({
      selectieId: 'selectie-1', projectie: projectie('wachten', datum),
      actorId: 'actor-1', operationKey: 'dossier:1',
    }).volgendeActieOp).toBe(datum);
    expect(bouwAcquisitieNaPostDossierPlan({
      selectieId: 'selectie-1', projectie: projectie('opvolgen', datum),
      actorId: 'actor-1', operationKey: 'dossier:2',
    }).primaireWerkbak).toBe('opvolgen');
  });

  it('weigert drift tussen werkbak en opvolgdatum', () => {
    expect(() => bouwAcquisitieNaPostDossierPlan({
      selectieId: 'selectie-1', projectie: projectie('wachten', null),
      actorId: 'actor-1', operationKey: 'dossier:1',
    })).toThrow('vereist een opvolgdatum');
    expect(() => bouwAcquisitieNaPostDossierPlan({
      selectieId: 'selectie-1',
      projectie: projectie('geprint_posten', '2026-08-20T10:00:00.000Z'),
      actorId: 'actor-1', operationKey: 'dossier:1',
    })).toThrow('mag nog geen opvolgdatum krijgen');
  });
});
