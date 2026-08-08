import { describe, expect, it } from 'vitest';

import type { NaPostOrchestratieResultaat } from './acquisitieNaPostOrchestratie';
import { projecteerAcquisitieNaPostResultaat } from './acquisitieNaPostProjectie';

function resultaat(input: {
  geslaagd: number;
  mislukt?: number;
  opvolgMislukt?: number;
  opvolgenOp?: string;
}): NaPostOrchestratieResultaat {
  const opvolgenOp = input.opvolgenOp ?? '2026-08-20T10:00:00.000Z';
  const geslaagdeCommandos = Array.from({ length: input.geslaagd }, (_, index) => ({
    briefId: `brief-${index + 1}`,
    briefVersieId: `versie-${index + 1}`,
    batchId: 'batch-1',
    actorId: 'actor-1',
    operationKey: `post:${index + 1}`,
    verzenddatum: '2026-08-06T10:00:00.000Z',
  }));
  const mislukteCommandos = Array.from({ length: input.mislukt ?? 0 }, (_, index) => ({
    briefId: `brief-mislukt-${index + 1}`,
    briefVersieId: `versie-mislukt-${index + 1}`,
    batchId: 'batch-1',
    actorId: 'actor-1',
    operationKey: `post:mislukt:${index + 1}`,
    verzenddatum: '2026-08-06T10:00:00.000Z',
  }));
  const opvolgCommandos = geslaagdeCommandos.map((commando) => ({
    briefId: commando.briefId,
    briefVersieId: commando.briefVersieId,
    batchId: commando.batchId,
    actorId: commando.actorId,
    operationKey: `opvolg:${commando.operationKey}`,
    verzondenOp: commando.verzenddatum,
    opvolgenOp,
    omschrijving: 'Opvolgen',
  }));
  const opvolgMislukt = input.opvolgMislukt ?? 0;

  return {
    postregistratie: {
      batchId: 'batch-1',
      geslaagdeCommandos,
      mislukteCommandos,
      retryCommandos: [...mislukteCommandos],
      volgendeBatchstatus: input.geslaagd > 0 && (input.mislukt ?? 0) === 0 ? 'gepost' : 'gedeeltelijk_gepost',
      volledigVerwerkt: (input.mislukt ?? 0) === 0,
    },
    opvolgCommandos,
    opvolgUitkomst: opvolgCommandos.length === 0 ? null : {
      uitkomsten: opvolgCommandos.map((commando, index) => ({
        operationKey: commando.operationKey,
        geslaagd: index >= opvolgMislukt,
        foutcode: index < opvolgMislukt ? 'TIJDELIJK_MISLUKT' : null,
      })),
      geslaagdAantal: opvolgCommandos.length - opvolgMislukt,
      misluktAantal: opvolgMislukt,
    },
  };
}

describe('projecteerAcquisitieNaPostResultaat', () => {
  it('houdt een gedeeltelijk geposte batch in geprint/posten zonder dossier-opvolgdatum', () => {
    const projectie = projecteerAcquisitieNaPostResultaat({
      resultaat: resultaat({ geslaagd: 1, mislukt: 1 }),
      totaalBriefversies: 2,
      nu: '2026-08-07T10:00:00.000Z',
    });

    expect(projectie.werkbak).toBe('geprint_posten');
    expect(projectie.retryPostNodig).toBe(true);
    expect(projectie.succesvolGepost).toBe(1);
    expect(projectie.opvolgenOp).toBeNull();
  });

  it('plaatst volledig geposte dossiers met toekomstige opvolging in wachten', () => {
    const projectie = projecteerAcquisitieNaPostResultaat({
      resultaat: resultaat({ geslaagd: 2 }),
      totaalBriefversies: 2,
      nu: '2026-08-07T10:00:00.000Z',
    });

    expect(projectie.werkbak).toBe('wachten');
    expect(projectie.retryPostNodig).toBe(false);
    expect(projectie.opvolgenOp).toBe('2026-08-20T10:00:00.000Z');
  });

  it('maakt mislukte opvolgtaken zichtbaar zonder de poststatus terug te draaien', () => {
    const projectie = projecteerAcquisitieNaPostResultaat({
      resultaat: resultaat({ geslaagd: 2, opvolgMislukt: 1 }),
      totaalBriefversies: 2,
      nu: '2026-08-07T10:00:00.000Z',
    });

    expect(projectie.werkbak).toBe('wachten');
    expect(projectie.retryOpvolgingNodig).toBe(true);
    expect(projectie.opvolgtakenMislukt).toBe(1);
  });

  it('weigert drift tussen geposte brieven en opvolgcommando’s', () => {
    const invoer = resultaat({ geslaagd: 1 });
    invoer.opvolgCommandos = [];

    expect(() => projecteerAcquisitieNaPostResultaat({
      resultaat: invoer,
      totaalBriefversies: 1,
      nu: '2026-08-07T10:00:00.000Z',
    })).toThrow('Iedere succesvol geposte briefversie moet exact één opvolgcommando hebben.');
  });
});
