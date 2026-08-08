import { describe, expect, it } from 'vitest';

import type { AcquisitieNaPostUseCaseMetAuditResultaat } from './acquisitieNaPostUseCaseMetAudit';
import { projecteerAcquisitieNaPostActiestatus } from './acquisitieNaPostActiestatus';

function resultaat(overrides?: {
  postMislukt?: number;
  opvolgMislukt?: number;
  dossierGeslaagd?: boolean;
  auditGeslaagd?: boolean;
}): AcquisitieNaPostUseCaseMetAuditResultaat {
  const postMislukt = overrides?.postMislukt ?? 0;
  const opvolgMislukt = overrides?.opvolgMislukt ?? 0;
  const dossierGeslaagd = overrides?.dossierGeslaagd ?? true;
  const auditGeslaagd = overrides?.auditGeslaagd ?? true;

  return {
    resultaat: {
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
          ? { uitkomsten: [], geslaagdAantal: 0, misluktAantal: opvolgMislukt }
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
        foutcode: dossierGeslaagd ? null : 'DOSSIER_MISLUKT',
      },
    },
    auditRecord: Object.freeze({
      type: 'na_post_verwerkt',
      selectieId: 'selectie-1',
      batchId: 'batch-1',
      actorId: 'actor-1',
      operationKey: 'audit:1',
      geregistreerdOp: '2026-08-06T18:00:00.000Z',
      kenmerken: Object.freeze({ werkbak: 'wachten' }),
    }),
    audit: {
      operationKey: 'audit:1',
      geslaagd: auditGeslaagd,
      foutcode: auditGeslaagd ? null : 'AUDIT_TIMEOUT',
    },
  };
}

describe('projecteerAcquisitieNaPostActiestatus', () => {
  it('geeft postregistratie de hoogste herstelprioriteit', () => {
    const status = projecteerAcquisitieNaPostActiestatus(resultaat({
      postMislukt: 1,
      opvolgMislukt: 1,
      dossierGeslaagd: false,
      auditGeslaagd: false,
    }));

    expect(status).toMatchObject({
      actie: 'postregistratie_herstellen',
      blokkeertVervolg: true,
      aantalMislukt: 1,
    });
  });

  it('maakt onderscheid tussen bedrijfsverwerking en een secundaire auditfout', () => {
    const status = projecteerAcquisitieNaPostActiestatus(resultaat({ auditGeslaagd: false }));

    expect(status).toMatchObject({
      actie: 'audit_herstellen',
      bedrijfsverwerkingGereed: true,
      volledigAfgerond: false,
      blokkeertVervolg: false,
      operationKey: 'audit:1',
    });
  });

  it('toont een volledig afgeronde keten zonder vervolgactie', () => {
    const status = projecteerAcquisitieNaPostActiestatus(resultaat());

    expect(status).toMatchObject({
      actie: 'geen',
      bedrijfsverwerkingGereed: true,
      volledigAfgerond: true,
      blokkeertVervolg: false,
      aantalMislukt: 0,
    });
    expect(Object.isFrozen(status)).toBe(true);
  });
});
