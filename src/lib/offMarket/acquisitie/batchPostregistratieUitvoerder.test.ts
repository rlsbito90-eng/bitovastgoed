import { describe, expect, it, vi } from 'vitest';

import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import { voerBatchPostregistratieUit } from './batchPostregistratieUitvoerder';

const plan: BatchPostregistratiePlan = {
  batchId: 'batch-1',
  commandos: [
    {
      briefId: 'brief-1',
      briefVersieId: 'versie-1',
      batchId: 'batch-1',
      actorId: 'actor-1',
      operationKey: 'post:1:versie-1',
      verzenddatum: '2026-08-06T16:00:00Z',
    },
    {
      briefId: 'brief-2',
      briefVersieId: 'versie-2',
      batchId: 'batch-1',
      actorId: 'actor-1',
      operationKey: 'post:2:versie-2',
      verzenddatum: '2026-08-06T16:00:00Z',
    },
  ],
  overgeslagenBriefVersieIds: [],
  gedeeltelijkGepost: false,
  volledigGepost: true,
};

describe('voerBatchPostregistratieUit', () => {
  it('voert commando’s in vaste volgorde uit en verzoent een volledig resultaat', async () => {
    const markeerBriefGepost = vi.fn(async () => undefined);

    const resultaat = await voerBatchPostregistratieUit({
      repository: { markeerBriefGepost },
      plan,
    });

    expect(markeerBriefGepost.mock.calls.map(([commando]) => commando.operationKey))
      .toEqual(['post:1:versie-1', 'post:2:versie-2']);
    expect(resultaat.volgendeBatchstatus).toBe('gepost');
    expect(resultaat.mislukteCommandos).toEqual([]);
  });

  it('gaat na een individuele fout door en retourneert uitsluitend die retry', async () => {
    const markeerBriefGepost = vi.fn()
      .mockRejectedValueOnce({ code: 'RPC_TIJDELIJK_ONBESCHIKBAAR', message: 'privé' })
      .mockResolvedValueOnce(undefined);

    const resultaat = await voerBatchPostregistratieUit({
      repository: { markeerBriefGepost },
      plan,
    });

    expect(markeerBriefGepost).toHaveBeenCalledTimes(2);
    expect(resultaat.volgendeBatchstatus).toBe('gedeeltelijk_gepost');
    expect(resultaat.retryCommandos.map((commando) => commando.operationKey))
      .toEqual(['post:1:versie-1']);
  });

  it('lekt geen vrije foutmelding als foutcode', async () => {
    const markeerBriefGepost = vi.fn(async () => {
      throw new Error('naam en adres mogen niet lekken');
    });

    const resultaat = await voerBatchPostregistratieUit({
      repository: { markeerBriefGepost },
      plan: { ...plan, commandos: [plan.commandos[0]] },
    });

    expect(resultaat.retryCommandos).toHaveLength(1);
    expect(JSON.stringify(resultaat)).not.toContain('naam en adres');
  });
});
