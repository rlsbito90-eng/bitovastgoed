import { describe, expect, it } from 'vitest';

import { bouwAcquisitieOpvolgPlan } from './acquisitieOpvolgPlan';

const commando = {
  briefId: 'brief-1',
  briefVersieId: 'versie-1',
  batchId: 'batch-1',
  actorId: 'actor-1',
  operationKey: 'post:1:versie-1',
  verzenddatum: '2026-08-06T12:00:00Z',
};

describe('bouwAcquisitieOpvolgPlan', () => {
  it('plant opvolging pas vanaf de expliciete verzenddatum', () => {
    expect(bouwAcquisitieOpvolgPlan({
      geposteCommandos: [commando],
      opvolgtermijnDagen: 14,
    })).toEqual([{
      briefId: 'brief-1',
      briefVersieId: 'versie-1',
      batchId: 'batch-1',
      actorId: 'actor-1',
      operationKey: 'opvolg:post:1:versie-1',
      verzondenOp: '2026-08-06T12:00:00Z',
      opvolgenOp: '2026-08-20T12:00:00.000Z',
      omschrijving: 'Neem contact op over de verzonden acquisitiebrief.',
    }]);
  });

  it('maakt geen opvolging voor niet-geposte of mislukte items', () => {
    expect(bouwAcquisitieOpvolgPlan({
      geposteCommandos: [],
      opvolgtermijnDagen: 14,
    })).toEqual([]);
  });

  it('sorteert deterministisch en weigert dubbele briefkoppelingen', () => {
    const tweede = {
      ...commando,
      briefId: 'brief-2',
      briefVersieId: 'versie-2',
      operationKey: 'post:2:versie-2',
    };
    expect(bouwAcquisitieOpvolgPlan({
      geposteCommandos: [tweede, commando],
      opvolgtermijnDagen: 7,
    }).map((item) => item.briefId)).toEqual(['brief-1', 'brief-2']);

    expect(() => bouwAcquisitieOpvolgPlan({
      geposteCommandos: [commando, { ...tweede, briefId: 'brief-1' }],
      opvolgtermijnDagen: 7,
    })).toThrow('Brief dubbel in opvolgplan');
  });

  it('weigert ongeldige termijnen, datums en buitensporige omschrijvingen', () => {
    expect(() => bouwAcquisitieOpvolgPlan({
      geposteCommandos: [commando], opvolgtermijnDagen: 0,
    })).toThrow('Opvolgtermijn moet');
    expect(() => bouwAcquisitieOpvolgPlan({
      geposteCommandos: [{ ...commando, verzenddatum: 'ongeldig' }],
      opvolgtermijnDagen: 7,
    })).toThrow('Verzenddatum van versie-1 is ongeldig');
    expect(() => bouwAcquisitieOpvolgPlan({
      geposteCommandos: [commando], opvolgtermijnDagen: 7, omschrijving: 'x'.repeat(501),
    })).toThrow('Opvolgomschrijving mag maximaal 500 tekens bevatten');
  });
});
