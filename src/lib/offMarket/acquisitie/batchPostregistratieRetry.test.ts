import { describe, expect, it } from 'vitest';

import type { BatchPostregistratieResultaat } from './batchPostregistratieResultaat';
import { bouwBatchPostregistratieRetryPlan } from './batchPostregistratieRetry';

const commando = {
  briefId: 'brief-1',
  briefVersieId: 'versie-1',
  batchId: 'batch-1',
  actorId: 'actor-1',
  operationKey: 'post:1:versie-1',
  verzenddatum: '2026-08-06T16:00:00Z',
};

function resultaat(retries = [commando]): BatchPostregistratieResultaat {
  return {
    batchId: 'batch-1',
    geslaagdeCommandos: [],
    mislukteCommandos: retries,
    retryCommandos: retries,
    volgendeBatchstatus: 'geprint',
    volledigVerwerkt: false,
  };
}

describe('bouwBatchPostregistratieRetryPlan', () => {
  it('behoudt operation keys en verhoogt uitsluitend het pogingnummer', () => {
    expect(bouwBatchPostregistratieRetryPlan({
      resultaat: resultaat(),
      huidigAantalPogingen: 1,
    })).toEqual({
      batchId: 'batch-1',
      commandos: [commando],
      aantalPogingen: 2,
    });
  });

  it('weigert retry zonder mislukte commando’s of na het maximum', () => {
    expect(() => bouwBatchPostregistratieRetryPlan({
      resultaat: resultaat([]),
      huidigAantalPogingen: 1,
    })).toThrow('Er zijn geen mislukte postcommando’s');

    expect(() => bouwBatchPostregistratieRetryPlan({
      resultaat: resultaat(),
      huidigAantalPogingen: 3,
    })).toThrow('Maximaal aantal postregistratiepogingen is bereikt.');
  });

  it('weigert dubbele operation keys en onbegrensde configuratie', () => {
    expect(() => bouwBatchPostregistratieRetryPlan({
      resultaat: resultaat([commando, { ...commando }]),
      huidigAantalPogingen: 1,
    })).toThrow('Dubbel retrycommando');

    expect(() => bouwBatchPostregistratieRetryPlan({
      resultaat: resultaat(),
      huidigAantalPogingen: 1,
      maximaalAantalPogingen: 4,
    })).toThrow('tussen 1 en 3');
  });
});
