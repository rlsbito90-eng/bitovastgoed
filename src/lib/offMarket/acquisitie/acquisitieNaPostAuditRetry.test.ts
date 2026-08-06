import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieNaPostAuditRecord } from './acquisitieNaPostAudit';
import {
  bouwAcquisitieNaPostAuditRetryPlan,
  voerAcquisitieNaPostAuditRetryUit,
} from './acquisitieNaPostAuditRetry';

function record(): AcquisitieNaPostAuditRecord {
  return Object.freeze({
    type: 'na_post_verwerkt',
    selectieId: 'selectie-1',
    batchId: 'batch-1',
    actorId: 'actor-1',
    operationKey: 'audit:na-post:1',
    geregistreerdOp: '2026-08-06T18:00:00.000Z',
    kenmerken: Object.freeze({
      succesvolGepost: 1,
      postregistratieMislukt: 0,
      opvolgtakenGeslaagd: 1,
      opvolgtakenMislukt: 0,
      dossierBijgewerkt: true,
      werkbak: 'wachten',
      opvolgenOp: '2026-08-20T12:00:00.000Z',
    }),
  });
}

describe('na-post auditretry', () => {
  it('hergebruikt exact hetzelfde immutable record en dezelfde operation key', async () => {
    const oorspronkelijk = record();
    const plan = bouwAcquisitieNaPostAuditRetryPlan({
      record: oorspronkelijk,
      uitkomst: {
        operationKey: 'audit:na-post:1',
        geslaagd: false,
        foutcode: 'AUDIT_TIMEOUT',
      },
      volgendePoging: 2,
    });
    const registreer = vi.fn(async () => undefined);

    const uitkomst = await voerAcquisitieNaPostAuditRetryUit({
      plan,
      poort: { registreer },
    });

    expect(plan.record).toBe(oorspronkelijk);
    expect(registreer).toHaveBeenCalledWith(oorspronkelijk);
    expect(uitkomst).toEqual({
      operationKey: 'audit:na-post:1',
      geslaagd: true,
      foutcode: null,
    });
  });

  it('weigert een retry van een reeds geslaagde auditregistratie', () => {
    expect(() => bouwAcquisitieNaPostAuditRetryPlan({
      record: record(),
      uitkomst: {
        operationKey: 'audit:na-post:1',
        geslaagd: true,
        foutcode: null,
      },
      volgendePoging: 2,
    })).toThrow('geslaagde auditregistratie');
  });

  it('weigert een afwijkende operation key en een vierde poging', () => {
    expect(() => bouwAcquisitieNaPostAuditRetryPlan({
      record: record(),
      uitkomst: {
        operationKey: 'audit:anders',
        geslaagd: false,
        foutcode: 'AUDIT_TIMEOUT',
      },
      volgendePoging: 2,
    })).toThrow('oorspronkelijke auditrecord');

    expect(() => bouwAcquisitieNaPostAuditRetryPlan({
      record: record(),
      uitkomst: {
        operationKey: 'audit:na-post:1',
        geslaagd: false,
        foutcode: 'AUDIT_TIMEOUT',
      },
      volgendePoging: 4,
    })).toThrow('Maximaal aantal auditpogingen');
  });

  it('weigert een opnieuw samengesteld mutabel record', () => {
    const mutabel = {
      ...record(),
      kenmerken: { succesvolGepost: 1 },
    } as AcquisitieNaPostAuditRecord;

    expect(() => bouwAcquisitieNaPostAuditRetryPlan({
      record: mutabel,
      uitkomst: {
        operationKey: 'audit:na-post:1',
        geslaagd: false,
        foutcode: 'AUDIT_TIMEOUT',
      },
      volgendePoging: 2,
    })).toThrow('immutable auditrecord');
  });
});
