import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieNaPostDossierCommando } from './acquisitieNaPostDossierPlan';
import { voerAcquisitieNaPostDossierPlanUit } from './acquisitieNaPostDossierUitvoerder';

const commando: AcquisitieNaPostDossierCommando = {
  selectieId: 'selectie-1',
  primaireWerkbak: 'wachten',
  volgendeActieOp: '2026-08-20T10:00:00.000Z',
  volgendeActieOmschrijving: 'Wacht tot de geplande opvolgdatum.',
  actorId: 'actor-1',
  operationKey: 'dossier:batch-1',
};

describe('voerAcquisitieNaPostDossierPlanUit', () => {
  it('voert exact het vooraf gebouwde commando uit', async () => {
    const werkDossierBij = vi.fn(async () => undefined);
    await expect(voerAcquisitieNaPostDossierPlanUit({
      commando,
      poort: { werkDossierBij },
    })).resolves.toEqual({
      selectieId: 'selectie-1',
      operationKey: 'dossier:batch-1',
      geslaagd: true,
      foutcode: null,
    });
    expect(werkDossierBij).toHaveBeenCalledOnce();
    expect(werkDossierBij).toHaveBeenCalledWith(commando);
  });

  it('normaliseert fouten zonder vrije foutmelding door te geven', async () => {
    const werkDossierBij = vi.fn(async () => {
      throw { code: 'CONFLICT', message: 'persoonlijke inhoud' };
    });
    const resultaat = await voerAcquisitieNaPostDossierPlanUit({
      commando,
      poort: { werkDossierBij },
    });
    expect(resultaat).toEqual({
      selectieId: 'selectie-1',
      operationKey: 'dossier:batch-1',
      geslaagd: false,
      foutcode: 'CONFLICT',
    });
    expect(JSON.stringify(resultaat)).not.toContain('persoonlijke inhoud');
  });

  it('gebruikt een generieke foutcode voor onveilige fouten', async () => {
    const resultaat = await voerAcquisitieNaPostDossierPlanUit({
      commando,
      poort: { werkDossierBij: async () => { throw new Error('adresinformatie'); } },
    });
    expect(resultaat.foutcode).toBe('DOSSIERPROJECTIE_MISLUKT');
  });
});
