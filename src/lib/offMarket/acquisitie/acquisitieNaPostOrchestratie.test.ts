import { describe, expect, it, vi } from 'vitest';

import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import { voerNaPostOrchestratieUit } from './acquisitieNaPostOrchestratie';

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

describe('voerNaPostOrchestratieUit', () => {
  it('maakt alleen opvolgtaken voor geslaagde postregistraties', async () => {
    const markeerBriefGepost = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: 'TIJDELIJK_MISLUKT' });
    const maakOpvolgtaak = vi.fn(async () => undefined);

    const resultaat = await voerNaPostOrchestratieUit({
      plan: plan(),
      poorten: {
        postRepository: { markeerBriefGepost },
        opvolgTaakpoort: { maakOpvolgtaak },
      },
      opvolgtermijnDagen: 14,
    });

    expect(resultaat.postregistratie.geslaagdeCommandos).toHaveLength(1);
    expect(resultaat.opvolgCommandos).toHaveLength(1);
    expect(resultaat.opvolgCommandos[0].briefVersieId).toBe('versie-1');
    expect(maakOpvolgtaak).toHaveBeenCalledTimes(1);
  });

  it('roept de opvolgpoort niet aan wanneer geen postregistratie slaagt', async () => {
    const maakOpvolgtaak = vi.fn(async () => undefined);
    const resultaat = await voerNaPostOrchestratieUit({
      plan: plan(),
      poorten: {
        postRepository: {
          markeerBriefGepost: vi.fn(async () => { throw { code: 'GEWEIGERD' }; }),
        },
        opvolgTaakpoort: { maakOpvolgtaak },
      },
      opvolgtermijnDagen: 14,
    });

    expect(resultaat.opvolgCommandos).toEqual([]);
    expect(resultaat.opvolgUitkomst).toBeNull();
    expect(maakOpvolgtaak).not.toHaveBeenCalled();
  });
});
