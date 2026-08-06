import { describe, expect, it, vi } from 'vitest';

import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import { voerAcquisitieNaPostUseCaseUit } from './acquisitieNaPostUseCase';

function plan(): BatchPostregistratiePlan {
  return {
    batchId: 'batch-1',
    commandos: [
      {
        briefId: 'brief-1',
        briefVersieId: 'versie-1',
        batchId: 'batch-1',
        actorId: 'actor-1',
        operationKey: 'post:1',
        verzenddatum: '2026-08-06T12:00:00.000Z',
      },
      {
        briefId: 'brief-2',
        briefVersieId: 'versie-2',
        batchId: 'batch-1',
        actorId: 'actor-1',
        operationKey: 'post:2',
        verzenddatum: '2026-08-06T12:00:00.000Z',
      },
    ],
    overgeslagenBriefVersieIds: [],
    gedeeltelijkGepost: false,
    volledigGepost: true,
  };
}

function basisPoorten() {
  return {
    postRepository: { markeerBriefGepost: vi.fn(async () => undefined) },
    opvolgTaakpoort: { maakOpvolgtaak: vi.fn(async () => undefined) },
    dossierPoort: { werkDossierBij: vi.fn(async () => undefined) },
  };
}

describe('voerAcquisitieNaPostUseCaseUit', () => {
  it('doorloopt posten, opvolgtaken en dossierprojectie in vaste volgorde', async () => {
    const poorten = basisPoorten();
    const resultaat = await voerAcquisitieNaPostUseCaseUit({
      selectieId: 'selectie-1',
      plan: plan(),
      totaalBriefversies: 2,
      actorId: 'actor-1',
      dossierOperationKey: 'dossier:na-post:1',
      opvolgtermijnDagen: 14,
      nu: '2026-08-06T13:00:00.000Z',
      poorten,
    });

    expect(poorten.postRepository.markeerBriefGepost).toHaveBeenCalledTimes(2);
    expect(poorten.opvolgTaakpoort.maakOpvolgtaak).toHaveBeenCalledTimes(2);
    expect(poorten.dossierPoort.werkDossierBij).toHaveBeenCalledTimes(1);
    expect(resultaat.projectie.werkbak).toBe('wachten');
    expect(resultaat.dossierCommando).toMatchObject({
      selectieId: 'selectie-1',
      primaireWerkbak: 'wachten',
      operationKey: 'dossier:na-post:1',
    });
    expect(resultaat.dossierUitkomst.geslaagd).toBe(true);
  });

  it('houdt het dossier in geprint_posten wanneer een postregistratie mislukt', async () => {
    const poorten = basisPoorten();
    poorten.postRepository.markeerBriefGepost
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: 'TIJDELIJK_MISLUKT' });

    const resultaat = await voerAcquisitieNaPostUseCaseUit({
      selectieId: 'selectie-1',
      plan: plan(),
      totaalBriefversies: 2,
      actorId: 'actor-1',
      dossierOperationKey: 'dossier:na-post:2',
      opvolgtermijnDagen: 14,
      nu: '2026-08-06T13:00:00.000Z',
      poorten,
    });

    expect(poorten.opvolgTaakpoort.maakOpvolgtaak).toHaveBeenCalledTimes(1);
    expect(resultaat.projectie.werkbak).toBe('geprint_posten');
    expect(resultaat.projectie.retryPostNodig).toBe(true);
    expect(resultaat.dossierCommando.volgendeActieOp).toBeNull();
  });

  it('rapporteert een mislukte dossierupdate zonder bewezen postresultaten terug te draaien', async () => {
    const poorten = basisPoorten();
    poorten.dossierPoort.werkDossierBij.mockRejectedValue({ code: 'DOSSIER_CONFLICT' });

    const resultaat = await voerAcquisitieNaPostUseCaseUit({
      selectieId: 'selectie-1',
      plan: plan(),
      totaalBriefversies: 2,
      actorId: 'actor-1',
      dossierOperationKey: 'dossier:na-post:3',
      opvolgtermijnDagen: 14,
      nu: '2026-08-06T13:00:00.000Z',
      poorten,
    });

    expect(resultaat.orchestratie.postregistratie.geslaagdeCommandos).toHaveLength(2);
    expect(resultaat.dossierUitkomst).toMatchObject({
      geslaagd: false,
      foutcode: 'DOSSIER_CONFLICT',
    });
  });
});
