import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieNaPostHerstelplan } from './acquisitieNaPostHerstelplan';
import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';
import { voerAcquisitieNaPostHerstelMetAuditUit } from './acquisitieNaPostHerstelMetAudit';

function oorspronkelijkResultaat(): AcquisitieNaPostUseCaseResultaat {
  return {
    orchestratie: {
      postregistratie: {
        batchId: 'batch-1',
        uitkomsten: [],
        geslaagdeCommandos: [],
        mislukteCommandos: [],
        retryCommandos: [],
        volgendeBatchstatus: 'gepost',
      },
      opvolgCommandos: [],
      opvolgUitkomst: null,
    },
    projectie: {
      batchId: 'batch-1',
      totaalBriefversies: 1,
      succesvolGepost: 1,
      postregistratieMislukt: 0,
      opvolgtakenGeslaagd: 0,
      opvolgtakenMislukt: 0,
      retryPostNodig: false,
      retryOpvolgingNodig: false,
      werkbak: 'wachten',
      werkbakReden: 'Alles verwerkt.',
      opvolgenOp: '2026-08-20T12:00:00.000Z',
    },
    dossierCommando: {
      selectieId: 'selectie-1',
      primaireWerkbak: 'wachten',
      volgendeActieOp: '2026-08-20T12:00:00.000Z',
      volgendeActieOmschrijving: 'Wacht tot de geplande opvolgdatum.',
      actorId: 'actor-1',
      operationKey: 'dossier:1',
    },
    dossierUitkomst: {
      selectieId: 'selectie-1',
      operationKey: 'dossier:1',
      geslaagd: false,
      foutcode: 'TIJDELIJK_MISLUKT',
    },
  };
}

function basisPoorten() {
  return {
    postRepository: { markeerBriefGepost: vi.fn(async () => undefined) },
    opvolgTaakpoort: { maakOpvolgtaak: vi.fn(async () => undefined) },
    dossierPoort: { werkDossierBij: vi.fn(async () => undefined) },
  };
}

describe('voerAcquisitieNaPostHerstelMetAuditUit', () => {
  it('registreert geen herstelaudit wanneer geen herstel nodig is', async () => {
    const registreer = vi.fn(async () => undefined);
    const plan: AcquisitieNaPostHerstelplan = {
      actie: 'geen',
      reden: 'Volledig verwerkt.',
      postRetry: null,
      opvolgRetry: null,
      dossierOperationKey: null,
    };

    const resultaat = await voerAcquisitieNaPostHerstelMetAuditUit({
      plan,
      oorspronkelijkResultaat: oorspronkelijkResultaat(),
      herstelPoorten: basisPoorten(),
      auditPoort: { registreer },
      selectieId: 'selectie-1',
      actorId: 'actor-1',
      auditOperationKey: 'audit:herstel:1',
      auditGeregistreerdOp: '2026-08-06T18:00:00.000Z',
    });

    expect(resultaat.herstel.uitgevoerd).toBe(false);
    expect(resultaat.audit).toBeNull();
    expect(registreer).not.toHaveBeenCalled();
  });

  it('registreert handmatige interventie zonder herstelwrite', async () => {
    const poorten = basisPoorten();
    const registreer = vi.fn(async () => undefined);
    const plan: AcquisitieNaPostHerstelplan = {
      actie: 'handmatige_interventie',
      reden: 'Maximum bereikt.',
      postRetry: null,
      opvolgRetry: null,
      dossierOperationKey: null,
    };

    const resultaat = await voerAcquisitieNaPostHerstelMetAuditUit({
      plan,
      oorspronkelijkResultaat: oorspronkelijkResultaat(),
      herstelPoorten: poorten,
      auditPoort: { registreer },
      selectieId: 'selectie-1',
      actorId: 'actor-1',
      auditOperationKey: 'audit:interventie:1',
      auditGeregistreerdOp: '2026-08-06T18:00:00.000Z',
    });

    expect(resultaat.herstel.uitgevoerd).toBe(false);
    expect(resultaat.audit?.geslaagd).toBe(true);
    expect(registreer).toHaveBeenCalledWith(expect.objectContaining({
      type: 'handmatige_interventie_nodig',
      operationKey: 'audit:interventie:1',
    }));
    expect(poorten.postRepository.markeerBriefGepost).not.toHaveBeenCalled();
    expect(poorten.opvolgTaakpoort.maakOpvolgtaak).not.toHaveBeenCalled();
    expect(poorten.dossierPoort.werkDossierBij).not.toHaveBeenCalled();
  });

  it('behoudt een geslaagde dossierretry wanneer alleen auditregistratie mislukt', async () => {
    const poorten = basisPoorten();
    const plan: AcquisitieNaPostHerstelplan = {
      actie: 'dossierbijwerking_opnieuw',
      reden: 'Dossierprojectie opnieuw uitvoeren.',
      postRetry: null,
      opvolgRetry: null,
      dossierOperationKey: 'dossier:1',
    };

    const resultaat = await voerAcquisitieNaPostHerstelMetAuditUit({
      plan,
      oorspronkelijkResultaat: oorspronkelijkResultaat(),
      herstelPoorten: poorten,
      auditPoort: {
        registreer: vi.fn(async () => { throw { code: 'AUDIT_TIMEOUT' }; }),
      },
      selectieId: 'selectie-1',
      actorId: 'actor-1',
      auditOperationKey: 'audit:dossierretry:1',
      auditGeregistreerdOp: '2026-08-06T18:00:00.000Z',
    });

    expect(resultaat.herstel.dossier?.geslaagd).toBe(true);
    expect(resultaat.audit).toEqual({
      operationKey: 'audit:dossierretry:1',
      geslaagd: false,
      foutcode: 'AUDIT_TIMEOUT',
    });
    expect(poorten.dossierPoort.werkDossierBij).toHaveBeenCalledTimes(1);
  });
});
