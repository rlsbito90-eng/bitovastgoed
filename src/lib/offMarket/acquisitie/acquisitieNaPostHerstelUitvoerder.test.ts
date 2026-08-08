import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieNaPostHerstelplan } from './acquisitieNaPostHerstelplan';
import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';
import { voerAcquisitieNaPostHerstelUit } from './acquisitieNaPostHerstelUitvoerder';

function oorspronkelijkResultaat(): AcquisitieNaPostUseCaseResultaat {
  return {
    dossierCommando: {
      selectieId: 'selectie-1',
      primaireWerkbak: 'wachten',
      volgendeActieOp: '2026-08-20T12:00:00.000Z',
      volgendeActieOmschrijving: 'Wacht tot de geplande opvolgdatum.',
      actorId: 'actor-1',
      operationKey: 'dossier:1',
    },
  } as AcquisitieNaPostUseCaseResultaat;
}

function poorten() {
  return {
    postRepository: { markeerBriefGepost: vi.fn(async () => undefined) },
    opvolgTaakpoort: { maakOpvolgtaak: vi.fn(async () => undefined) },
    dossierPoort: { werkDossierBij: vi.fn(async () => undefined) },
  };
}

describe('voerAcquisitieNaPostHerstelUit', () => {
  it('voert bij handmatige interventie geen enkele write uit', async () => {
    const p = poorten();
    const plan: AcquisitieNaPostHerstelplan = {
      actie: 'handmatige_interventie',
      reden: 'Maximum bereikt.',
      postRetry: null,
      opvolgRetry: null,
      dossierOperationKey: null,
    };

    const uitkomst = await voerAcquisitieNaPostHerstelUit({
      plan,
      oorspronkelijkResultaat: oorspronkelijkResultaat(),
      poorten: p,
    });

    expect(uitkomst.uitgevoerd).toBe(false);
    expect(p.postRepository.markeerBriefGepost).not.toHaveBeenCalled();
    expect(p.opvolgTaakpoort.maakOpvolgtaak).not.toHaveBeenCalled();
    expect(p.dossierPoort.werkDossierBij).not.toHaveBeenCalled();
  });

  it('herhaalt uitsluitend de mislukte postcommando’s met dezelfde operation keys', async () => {
    const p = poorten();
    const plan: AcquisitieNaPostHerstelplan = {
      actie: 'postregistratie_opnieuw',
      reden: 'Postregistratie mislukt.',
      postRetry: {
        batchId: 'batch-1',
        aantalPogingen: 2,
        commandos: [{
          briefId: 'brief-2',
          briefVersieId: 'versie-2',
          batchId: 'batch-1',
          actorId: 'actor-1',
          operationKey: 'post:2',
          verzenddatum: '2026-08-06T12:00:00.000Z',
        }],
      },
      opvolgRetry: null,
      dossierOperationKey: null,
    };

    const uitkomst = await voerAcquisitieNaPostHerstelUit({
      plan,
      oorspronkelijkResultaat: oorspronkelijkResultaat(),
      poorten: p,
    });

    expect(uitkomst.postregistratie?.geslaagdeCommandos[0].operationKey).toBe('post:2');
    expect(p.postRepository.markeerBriefGepost).toHaveBeenCalledTimes(1);
    expect(p.opvolgTaakpoort.maakOpvolgtaak).not.toHaveBeenCalled();
    expect(p.dossierPoort.werkDossierBij).not.toHaveBeenCalled();
  });

  it('weigert dossierherstel met een afwijkende operation key', async () => {
    const p = poorten();
    const plan: AcquisitieNaPostHerstelplan = {
      actie: 'dossierbijwerking_opnieuw',
      reden: 'Dossierupdate mislukt.',
      postRetry: null,
      opvolgRetry: null,
      dossierOperationKey: 'dossier:afwijkend',
    };

    await expect(voerAcquisitieNaPostHerstelUit({
      plan,
      oorspronkelijkResultaat: oorspronkelijkResultaat(),
      poorten: p,
    })).rejects.toThrow('oorspronkelijke operation key');

    expect(p.dossierPoort.werkDossierBij).not.toHaveBeenCalled();
  });
});
