import { describe, expect, it, vi } from 'vitest';

import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import { voerAcquisitieNaPostUseCaseMetAuditUit } from './acquisitieNaPostUseCaseMetAudit';

function plan(): BatchPostregistratiePlan {
  return {
    batchId: 'batch-1',
    commandos: [{
      briefId: 'brief-1',
      briefVersieId: 'versie-1',
      batchId: 'batch-1',
      actorId: 'actor-1',
      operationKey: 'post:1',
      verzenddatum: '2026-08-06T12:00:00.000Z',
    }],
    overgeslagenBriefVersieIds: [],
    gedeeltelijkGepost: false,
    volledigGepost: true,
  };
}

function useCaseInput() {
  return {
    selectieId: 'selectie-1',
    plan: plan(),
    totaalBriefversies: 1,
    actorId: 'actor-1',
    dossierOperationKey: 'dossier:1',
    opvolgtermijnDagen: 14,
    nu: '2026-08-06T13:00:00.000Z',
    poorten: {
      postRepository: { markeerBriefGepost: vi.fn(async () => undefined) },
      opvolgTaakpoort: { maakOpvolgtaak: vi.fn(async () => undefined) },
      dossierPoort: { werkDossierBij: vi.fn(async () => undefined) },
    },
  };
}

describe('voerAcquisitieNaPostUseCaseMetAuditUit', () => {
  it('registreert na de bedrijfsuitvoering één privacyveilig auditrecord', async () => {
    const registreer = vi.fn(async () => undefined);

    const uitkomst = await voerAcquisitieNaPostUseCaseMetAuditUit({
      useCase: useCaseInput(),
      auditPoort: { registreer },
      auditGeregistreerdOp: '2026-08-06T18:00:00.000Z',
    });

    expect(uitkomst.resultaat.dossierUitkomst.geslaagd).toBe(true);
    expect(uitkomst.audit.geslaagd).toBe(true);
    expect(registreer).toHaveBeenCalledOnce();
    const record = registreer.mock.calls[0][0];
    expect(record.type).toBe('na_post_verwerkt');
    expect(record.operationKey).toBe('dossier:1');
    expect(JSON.stringify(record)).not.toContain('straat');
  });

  it('behoudt de bedrijfsuitkomst wanneer alleen auditregistratie mislukt', async () => {
    const uitkomst = await voerAcquisitieNaPostUseCaseMetAuditUit({
      useCase: useCaseInput(),
      auditPoort: {
        registreer: vi.fn(async () => { throw { code: 'AUDIT_NIET_BESCHIKBAAR' }; }),
      },
      auditGeregistreerdOp: '2026-08-06T18:00:00.000Z',
    });

    expect(uitkomst.resultaat.orchestratie.postregistratie.geslaagdeCommandos).toHaveLength(1);
    expect(uitkomst.resultaat.dossierUitkomst.geslaagd).toBe(true);
    expect(uitkomst.audit).toEqual({
      operationKey: 'dossier:1',
      geslaagd: false,
      foutcode: 'AUDIT_NIET_BESCHIKBAAR',
    });
  });
});
