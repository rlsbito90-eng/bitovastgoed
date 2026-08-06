import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieNaPostAuditRecord } from './acquisitieNaPostAudit';
import { registreerAcquisitieNaPostAudit } from './acquisitieNaPostAuditUitvoerder';

const record: AcquisitieNaPostAuditRecord = Object.freeze({
  type: 'na_post_verwerkt',
  selectieId: 'selectie-1',
  batchId: 'batch-1',
  actorId: 'actor-1',
  operationKey: 'dossier:1',
  geregistreerdOp: '2026-08-06T18:00:00.000Z',
  kenmerken: Object.freeze({ werkbak: 'wachten' }),
});

describe('registreerAcquisitieNaPostAudit', () => {
  it('registreert exact het reeds opgebouwde auditrecord', async () => {
    const registreer = vi.fn(async () => undefined);

    const uitkomst = await registreerAcquisitieNaPostAudit({
      record,
      poort: { registreer },
    });

    expect(registreer).toHaveBeenCalledOnce();
    expect(registreer).toHaveBeenCalledWith(record);
    expect(uitkomst).toEqual({
      operationKey: 'dossier:1',
      geslaagd: true,
      foutcode: null,
    });
  });

  it('normaliseert een auditfout zonder vrije foutmelding door te geven', async () => {
    const uitkomst = await registreerAcquisitieNaPostAudit({
      record,
      poort: {
        registreer: vi.fn(async () => {
          throw { code: 'AUDIT_TIJDELIJK', message: 'adres of andere gevoelige details' };
        }),
      },
    });

    expect(uitkomst).toEqual({
      operationKey: 'dossier:1',
      geslaagd: false,
      foutcode: 'AUDIT_TIJDELIJK',
    });
    expect(JSON.stringify(uitkomst)).not.toContain('gevoelige');
  });

  it('gebruikt een vaste foutcode voor onbekende fouten', async () => {
    const uitkomst = await registreerAcquisitieNaPostAudit({
      record,
      poort: { registreer: vi.fn(async () => { throw new Error('vrij bericht'); }) },
    });

    expect(uitkomst.foutcode).toBe('NA_POST_AUDIT_MISLUKT');
  });
});
