import { describe, expect, it } from 'vitest';

import { bouwBatchPostregistratiePlan } from './batchPostregistratiePlan';

const batch = {
  id: 'batch-1', batchnummer: 'BAT2026080601', status: 'geprint' as const,
  documentversie: 1, aanvullingOpBatchId: null,
  printdatum: '2026-08-06T15:00:00Z', verzenddatum: null,
  geannuleerdOp: null, annuleringsreden: null,
};

describe('bouwBatchPostregistratiePlan', () => {
  it('maakt alleen voor expliciet geposte briefversies een commando', () => {
    const resultaat = bouwBatchPostregistratiePlan({
      batch,
      actorId: 'actor-1',
      operationKeyPrefix: 'post-batch-1',
      items: [
        { briefId: 'b1', briefVersieId: 'v1', gepost: true, verzenddatum: '2026-08-06T16:00:00Z' },
        { briefId: 'b2', briefVersieId: 'v2', gepost: false, verzenddatum: null },
      ],
    });
    expect(resultaat.gedeeltelijkGepost).toBe(true);
    expect(resultaat.volledigGepost).toBe(false);
    expect(resultaat.commandos).toEqual([{
      briefId: 'b1', briefVersieId: 'v1', batchId: 'batch-1', actorId: 'actor-1',
      operationKey: 'post-batch-1:1:v1', verzenddatum: '2026-08-06T16:00:00Z',
    }]);
    expect(resultaat.overgeslagenBriefVersieIds).toEqual(['v2']);
  });

  it('herkent een volledig geposte batch zonder printen gelijk te stellen aan posten', () => {
    const resultaat = bouwBatchPostregistratiePlan({
      batch,
      actorId: 'actor-1', operationKeyPrefix: 'post-batch-1',
      items: [
        { briefId: 'b1', briefVersieId: 'v1', gepost: true, verzenddatum: '2026-08-06T16:00:00Z' },
      ],
    });
    expect(resultaat.volledigGepost).toBe(true);
    expect(resultaat.gedeeltelijkGepost).toBe(false);
  });

  it('weigert verzenddatums vóór printen en impliciete verzenddatums', () => {
    expect(() => bouwBatchPostregistratiePlan({
      batch, actorId: 'actor-1', operationKeyPrefix: 'post',
      items: [{ briefId: 'b1', briefVersieId: 'v1', gepost: true, verzenddatum: '2026-08-06T14:00:00Z' }],
    })).toThrow('ligt vóór de printdatum');

    expect(() => bouwBatchPostregistratiePlan({
      batch, actorId: 'actor-1', operationKeyPrefix: 'post',
      items: [{ briefId: 'b1', briefVersieId: 'v1', gepost: false, verzenddatum: '2026-08-06T16:00:00Z' }],
    })).toThrow('heeft toch een verzenddatum');
  });

  it('weigert ongeschikte batches en dubbele briefkoppelingen', () => {
    expect(() => bouwBatchPostregistratiePlan({
      batch: { ...batch, status: 'concept', printdatum: null },
      actorId: 'actor-1', operationKeyPrefix: 'post',
      items: [{ briefId: 'b1', briefVersieId: 'v1', gepost: false, verzenddatum: null }],
    })).toThrow('vereist een geprinte of gedeeltelijk geposte batch');

    expect(() => bouwBatchPostregistratiePlan({
      batch, actorId: 'actor-1', operationKeyPrefix: 'post',
      items: [
        { briefId: 'b1', briefVersieId: 'v1', gepost: false, verzenddatum: null },
        { briefId: 'b1', briefVersieId: 'v2', gepost: false, verzenddatum: null },
      ],
    })).toThrow('Brief dubbel in postregistratie');
  });
});
