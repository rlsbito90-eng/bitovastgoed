import { describe, expect, it } from 'vitest';

import type { AcquisitieNaPostUseCaseResultaat } from './acquisitieNaPostUseCase';
import { bouwAcquisitieNaPostHerstelplan } from './acquisitieNaPostHerstelplan';

function basisResultaat(): AcquisitieNaPostUseCaseResultaat {
  const commando = {
    briefId: 'brief-1',
    briefVersieId: 'versie-1',
    batchId: 'batch-1',
    actorId: 'actor-1',
    operationKey: 'post:1',
    verzenddatum: '2026-08-06T12:00:00.000Z',
  };
  return {
    orchestratie: {
      postregistratie: {
        batchId: 'batch-1',
        geslaagdeCommandos: [commando],
        mislukteCommandos: [],
        retryCommandos: [],
        volgendeBatchstatus: 'gepost',
        volledigVerwerkt: true,
      },
      opvolgCommandos: [{
        briefId: 'brief-1',
        briefVersieId: 'versie-1',
        batchId: 'batch-1',
        actorId: 'actor-1',
        operationKey: 'opvolg:post:1',
        verzondenOp: '2026-08-06T12:00:00.000Z',
        opvolgenOp: '2026-08-20T12:00:00.000Z',
        omschrijving: 'Volg op.',
      }],
      opvolgUitkomst: {
        uitkomsten: [{ operationKey: 'opvolg:post:1', geslaagd: true, foutcode: null }],
        geslaagdAantal: 1,
        misluktAantal: 0,
      },
    },
    projectie: {
      batchId: 'batch-1',
      totaalBriefversies: 1,
      succesvolGepost: 1,
      postregistratieMislukt: 0,
      opvolgtakenGeslaagd: 1,
      opvolgtakenMislukt: 0,
      retryPostNodig: false,
      retryOpvolgingNodig: false,
      werkbak: 'wachten',
      werkbakReden: 'Alles is gepost.',
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
      geslaagd: true,
      foutcode: null,
    },
  };
}

describe('bouwAcquisitieNaPostHerstelplan', () => {
  it('prioriteert een postretry boven afgeleide herstelacties', () => {
    const resultaat = basisResultaat();
    const mislukt = resultaat.orchestratie.postregistratie.geslaagdeCommandos.pop()!;
    resultaat.orchestratie.postregistratie.mislukteCommandos = [mislukt];
    resultaat.orchestratie.postregistratie.retryCommandos = [mislukt];
    resultaat.orchestratie.opvolgUitkomst = null;
    resultaat.orchestratie.opvolgCommandos = [];
    resultaat.dossierUitkomst = { ...resultaat.dossierUitkomst, geslaagd: false, foutcode: 'FOUT' };

    const plan = bouwAcquisitieNaPostHerstelplan({ resultaat, postPoging: 1, opvolgPoging: 1 });

    expect(plan.actie).toBe('postregistratie_opnieuw');
    expect(plan.postRetry?.aantalPogingen).toBe(2);
    expect(plan.postRetry?.commandos[0].operationKey).toBe('post:1');
    expect(plan.dossierOperationKey).toBeNull();
  });

  it('bouwt uitsluitend een retry voor mislukte opvolgtaken', () => {
    const resultaat = basisResultaat();
    resultaat.orchestratie.opvolgUitkomst = {
      uitkomsten: [{ operationKey: 'opvolg:post:1', geslaagd: false, foutcode: 'TIJDELIJK' }],
      geslaagdAantal: 0,
      misluktAantal: 1,
    };

    const plan = bouwAcquisitieNaPostHerstelplan({ resultaat, postPoging: 1, opvolgPoging: 1 });

    expect(plan.actie).toBe('opvolgtaken_opnieuw');
    expect(plan.opvolgRetry?.poging).toBe(2);
    expect(plan.opvolgRetry?.commandos[0].operationKey).toBe('opvolg:post:1');
  });

  it('behoudt voor dossierherstel exact dezelfde operation key', () => {
    const resultaat = basisResultaat();
    resultaat.dossierUitkomst = {
      selectieId: 'selectie-1',
      operationKey: 'dossier:1',
      geslaagd: false,
      foutcode: 'DOSSIERPROJECTIE_MISLUKT',
    };

    const plan = bouwAcquisitieNaPostHerstelplan({ resultaat, postPoging: 1, opvolgPoging: 1 });

    expect(plan.actie).toBe('dossierbijwerking_opnieuw');
    expect(plan.dossierOperationKey).toBe('dossier:1');
  });

  it('vereist handmatige interventie na drie mislukte postpogingen', () => {
    const resultaat = basisResultaat();
    const mislukt = resultaat.orchestratie.postregistratie.geslaagdeCommandos.pop()!;
    resultaat.orchestratie.postregistratie.mislukteCommandos = [mislukt];
    resultaat.orchestratie.postregistratie.retryCommandos = [mislukt];

    const plan = bouwAcquisitieNaPostHerstelplan({ resultaat, postPoging: 3, opvolgPoging: 1 });

    expect(plan.actie).toBe('handmatige_interventie');
    expect(plan.postRetry).toBeNull();
  });
});
