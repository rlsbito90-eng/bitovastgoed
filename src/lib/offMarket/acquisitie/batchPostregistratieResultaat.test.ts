import { describe, expect, it } from 'vitest';

import type { BatchPostregistratiePlan } from './batchPostregistratiePlan';
import { verzoenBatchPostregistratieResultaat } from './batchPostregistratieResultaat';

const plan: BatchPostregistratiePlan = {
  batchId: 'batch-1',
  commandos: [
    {
      briefId: 'brief-1', briefVersieId: 'versie-1', batchId: 'batch-1',
      actorId: 'actor-1', operationKey: 'post:1:versie-1',
      verzenddatum: '2026-08-06T12:00:00Z',
    },
    {
      briefId: 'brief-2', briefVersieId: 'versie-2', batchId: 'batch-1',
      actorId: 'actor-1', operationKey: 'post:2:versie-2',
      verzenddatum: '2026-08-06T12:00:00Z',
    },
  ],
  overgeslagenBriefVersieIds: [],
  gedeeltelijkGepost: false,
  volledigGepost: true,
};

describe('verzoenBatchPostregistratieResultaat', () => {
  it('markeert de batch pas gepost wanneer ieder item aantoonbaar slaagt', () => {
    const resultaat = verzoenBatchPostregistratieResultaat({
      plan,
      uitkomsten: [
        { operationKey: 'post:1:versie-1', geslaagd: true, foutcode: null },
        { operationKey: 'post:2:versie-2', geslaagd: true, foutcode: null },
      ],
    });

    expect(resultaat.volgendeBatchstatus).toBe('gepost');
    expect(resultaat.volledigVerwerkt).toBe(true);
    expect(resultaat.retryCommandos).toEqual([]);
  });

  it('houdt alleen mislukte commando’s over voor retry', () => {
    const resultaat = verzoenBatchPostregistratieResultaat({
      plan,
      uitkomsten: [
        { operationKey: 'post:1:versie-1', geslaagd: true, foutcode: null },
        { operationKey: 'post:2:versie-2', geslaagd: false, foutcode: 'tijdelijk_onbeschikbaar' },
      ],
    });

    expect(resultaat.volgendeBatchstatus).toBe('gedeeltelijk_gepost');
    expect(resultaat.retryCommandos.map((item) => item.briefVersieId)).toEqual(['versie-2']);
    expect(resultaat.volledigVerwerkt).toBe(false);
  });

  it('weigert onbekende, dubbele en ontbrekende uitkomsten', () => {
    expect(() => verzoenBatchPostregistratieResultaat({
      plan,
      uitkomsten: [
        { operationKey: 'onbekend', geslaagd: true, foutcode: null },
        { operationKey: 'post:2:versie-2', geslaagd: true, foutcode: null },
      ],
    })).toThrow('Onbekende postuitkomst');

    expect(() => verzoenBatchPostregistratieResultaat({
      plan,
      uitkomsten: [
        { operationKey: 'post:1:versie-1', geslaagd: true, foutcode: null },
        { operationKey: 'post:1:versie-1', geslaagd: true, foutcode: null },
      ],
    })).toThrow('Dubbele postuitkomst');

    expect(() => verzoenBatchPostregistratieResultaat({
      plan,
      uitkomsten: [{ operationKey: 'post:1:versie-1', geslaagd: true, foutcode: null }],
    })).toThrow('Postuitkomsten ontbreken voor');
  });

  it('weigert inconsistente foutcodes', () => {
    expect(() => verzoenBatchPostregistratieResultaat({
      plan,
      uitkomsten: [
        { operationKey: 'post:1:versie-1', geslaagd: true, foutcode: 'toch_fout' },
        { operationKey: 'post:2:versie-2', geslaagd: true, foutcode: null },
      ],
    })).toThrow('bevat een foutcode');
  });
});
