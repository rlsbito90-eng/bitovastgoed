import { describe, expect, it } from 'vitest';

import type { AcquisitieNaPostHerstelUitkomst } from './acquisitieNaPostHerstelUitvoerder';
import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';
import {
  bouwAcquisitieNaPostAuditRecord,
  bouwAcquisitieNaPostHerstelAuditRecord,
} from './acquisitieNaPostAudit';

function resultaat(overrides?: {
  postMislukt?: number;
  opvolgMislukt?: number;
  dossierGeslaagd?: boolean;
}): AcquisitieNaPostUseCaseResultaat {
  const postMislukt = overrides?.postMislukt ?? 0;
  const opvolgMislukt = overrides?.opvolgMislukt ?? 0;
  const dossierGeslaagd = overrides?.dossierGeslaagd ?? true;

  return {
    orchestratie: {
      postregistratie: {
        batchId: 'batch-1',
        geslaagdeCommandos: [],
        mislukteCommandos: Array.from({ length: postMislukt }, (_, index) => ({
          briefId: `brief-${index}`,
          briefVersieId: `versie-${index}`,
          batchId: 'batch-1',
          actorId: 'actor-1',
          operationKey: `post:${index}`,
          verzenddatum: '2026-08-06T12:00:00.000Z',
        })),
        retryCommandos: [],
        volgendeBatchstatus: postMislukt > 0 ? 'geprint' : 'gepost',
        volledigVerwerkt: postMislukt === 0,
      },
      opvolgCommandos: [],
      opvolgUitkomst: opvolgMislukt > 0
        ? {
            uitkomsten: [],
            geslaagdAantal: 0,
            misluktAantal: opvolgMislukt,
          }
        : null,
    },
    projectie: {
      batchId: 'batch-1',
      totaalBriefversies: 2,
      succesvolGepost: postMislukt > 0 ? 1 : 2,
      postregistratieMislukt: postMislukt,
      opvolgtakenGeslaagd: opvolgMislukt > 0 ? 1 : 2,
      opvolgtakenMislukt: opvolgMislukt,
      retryPostNodig: postMislukt > 0,
      retryOpvolgingNodig: opvolgMislukt > 0,
      werkbak: postMislukt > 0 ? 'geprint_posten' : 'wachten',
      werkbakReden: 'test',
      opvolgenOp: postMislukt > 0 ? null : '2026-08-20T12:00:00.000Z',
    },
    dossierCommando: {
      selectieId: 'selectie-1',
      primaireWerkbak: postMislukt > 0 ? 'geprint_posten' : 'wachten',
      volgendeActieOp: postMislukt > 0 ? null : '2026-08-20T12:00:00.000Z',
      volgendeActieOmschrijving: 'test',
      actorId: 'actor-1',
      operationKey: 'dossier:1',
    },
    dossierUitkomst: {
      selectieId: 'selectie-1',
      operationKey: 'dossier:1',
      geslaagd: dossierGeslaagd,
      foutcode: dossierGeslaagd ? null : 'DOSSIERPROJECTIE_MISLUKT',
    },
  };
}

describe('na-post auditprojectie', () => {
  it('classificeert een volledig verwerkte keten zonder persoonsgegevens', () => {
    const record = bouwAcquisitieNaPostAuditRecord({
      selectieId: 'selectie-1',
      actorId: 'actor-1',
      geregistreerdOp: '2026-08-06T18:00:00.000Z',
      resultaat: resultaat(),
    });

    expect(record.type).toBe('na_post_verwerkt');
    expect(record.kenmerken).toMatchObject({
      succesvolGepost: 2,
      dossierBijgewerkt: true,
      werkbak: 'wachten',
    });
    expect(JSON.stringify(record)).not.toContain('straat');
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.kenmerken)).toBe(true);
  });

  it('geeft postregistratiefouten voorrang in de auditclassificatie', () => {
    const record = bouwAcquisitieNaPostAuditRecord({
      selectieId: 'selectie-1',
      actorId: 'actor-1',
      geregistreerdOp: '2026-08-06T18:00:00.000Z',
      resultaat: resultaat({ postMislukt: 1, opvolgMislukt: 1, dossierGeslaagd: false }),
    });

    expect(record.type).toBe('postregistratie_onvolledig');
    expect(record.kenmerken.postregistratieMislukt).toBe(1);
  });

  it('registreert handmatige interventie zonder een write te suggereren', () => {
    const uitkomst: AcquisitieNaPostHerstelUitkomst = {
      actie: 'handmatige_interventie',
      uitgevoerd: false,
      postregistratie: null,
      opvolging: null,
      dossier: null,
    };

    const record = bouwAcquisitieNaPostHerstelAuditRecord({
      selectieId: 'selectie-1',
      batchId: 'batch-1',
      actorId: 'actor-1',
      operationKey: 'herstel:1',
      geregistreerdOp: '2026-08-06T18:00:00.000Z',
      uitkomst,
    });

    expect(record.type).toBe('handmatige_interventie_nodig');
    expect(record.kenmerken).toMatchObject({
      herstelactie: 'handmatige_interventie',
      uitgevoerd: false,
    });
  });

  it('weigert niet-canonieke registratietijden', () => {
    expect(() => bouwAcquisitieNaPostAuditRecord({
      selectieId: 'selectie-1',
      actorId: 'actor-1',
      geregistreerdOp: '2026-08-06T18:00:00Z',
      resultaat: resultaat(),
    })).toThrow('canoniek UTC');
  });
});
