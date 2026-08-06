import { describe, expect, it, vi } from 'vitest';

import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import { voerAcquisitieNaPostUseCaseMetAuditUit } from './acquisitieNaPostUseCaseMetAudit';
import {
  bouwAcquisitieNaPostAuditRetryPlan,
  voerAcquisitieNaPostAuditRetryUit,
} from './acquisitieNaPostAuditRetry';

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

describe('auditretry over de volledige na-postketen', () => {
  it('herhaalt na een auditfout uitsluitend de auditwrite', async () => {
    const markeerBriefGepost = vi.fn(async () => undefined);
    const maakOpvolgtaak = vi.fn(async () => undefined);
    const werkDossierBij = vi.fn(async () => undefined);
    const registreer = vi.fn()
      .mockRejectedValueOnce({ code: 'AUDIT_TIMEOUT' })
      .mockResolvedValueOnce(undefined);

    const eerstePoging = await voerAcquisitieNaPostUseCaseMetAuditUit({
      useCase: {
        selectieId: 'selectie-1',
        plan: plan(),
        totaalBriefversies: 1,
        actorId: 'actor-1',
        dossierOperationKey: 'dossier:1',
        opvolgtermijnDagen: 14,
        nu: '2026-08-06T13:00:00.000Z',
        poorten: {
          postRepository: { markeerBriefGepost },
          opvolgTaakpoort: { maakOpvolgtaak },
          dossierPoort: { werkDossierBij },
        },
      },
      auditPoort: { registreer },
      auditOperationKey: 'audit:na-post:1',
      auditGeregistreerdOp: '2026-08-06T18:00:00.000Z',
    });

    expect(eerstePoging.audit).toEqual({
      operationKey: 'audit:na-post:1',
      geslaagd: false,
      foutcode: 'AUDIT_TIMEOUT',
    });

    const retryPlan = bouwAcquisitieNaPostAuditRetryPlan({
      record: eerstePoging.auditRecord,
      uitkomst: eerstePoging.audit,
      volgendePoging: 2,
    });
    const retryUitkomst = await voerAcquisitieNaPostAuditRetryUit({
      plan: retryPlan,
      poort: { registreer },
    });

    expect(retryUitkomst).toEqual({
      operationKey: 'audit:na-post:1',
      geslaagd: true,
      foutcode: null,
    });
    expect(registreer).toHaveBeenCalledTimes(2);
    expect(registreer.mock.calls[1][0]).toBe(eerstePoging.auditRecord);

    expect(markeerBriefGepost).toHaveBeenCalledTimes(1);
    expect(maakOpvolgtaak).toHaveBeenCalledTimes(1);
    expect(werkDossierBij).toHaveBeenCalledTimes(1);
  });
});
