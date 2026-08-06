import { describe, expect, it } from 'vitest';

import type { AcquisitieOpvolgCommando } from './acquisitieOpvolgPlan';
import { bouwAcquisitieOpvolgRetryPlan } from './acquisitieOpvolgRetry';
import type { AcquisitieOpvolgUitvoerResultaat } from './acquisitieOpvolgUitvoerder';

function commando(suffix: string): AcquisitieOpvolgCommando {
  return {
    briefId: `brief-${suffix}`,
    briefVersieId: `versie-${suffix}`,
    batchId: 'batch-1',
    actorId: 'actor-1',
    operationKey: `opvolg:post:${suffix}`,
    verzondenOp: '2026-08-06T12:00:00Z',
    opvolgenOp: '2026-08-13T12:00:00Z',
    omschrijving: 'Neem contact op.',
  };
}

function resultaat(): AcquisitieOpvolgUitvoerResultaat {
  return {
    uitkomsten: [
      { operationKey: 'opvolg:post:1', geslaagd: true, foutcode: null },
      { operationKey: 'opvolg:post:2', geslaagd: false, foutcode: 'TEMPORARY_UNAVAILABLE' },
    ],
    geslaagdAantal: 1,
    misluktAantal: 1,
  };
}

describe('bouwAcquisitieOpvolgRetryPlan', () => {
  it('selecteert alleen mislukte commando’s en behoudt operation keys', () => {
    const plan = bouwAcquisitieOpvolgRetryPlan({
      oorspronkelijkeCommandos: [commando('1'), commando('2')],
      resultaat: resultaat(),
      volgendePoging: 2,
    });

    expect(plan.poging).toBe(2);
    expect(plan.commandos.map((item) => item.operationKey)).toEqual(['opvolg:post:2']);
  });

  it('weigert onbekende, dubbele en ontbrekende uitkomsten', () => {
    const basis = [commando('1'), commando('2')];
    expect(() => bouwAcquisitieOpvolgRetryPlan({
      oorspronkelijkeCommandos: basis,
      resultaat: {
        ...resultaat(),
        uitkomsten: [{ operationKey: 'onbekend', geslaagd: false, foutcode: 'X' }],
      },
      volgendePoging: 2,
    })).toThrow('Onbekende opvolguitkomst');

    expect(() => bouwAcquisitieOpvolgRetryPlan({
      oorspronkelijkeCommandos: basis,
      resultaat: {
        ...resultaat(),
        uitkomsten: [
          { operationKey: 'opvolg:post:1', geslaagd: false, foutcode: 'X' },
          { operationKey: 'opvolg:post:1', geslaagd: false, foutcode: 'X' },
        ],
      },
      volgendePoging: 2,
    })).toThrow('Dubbele opvolguitkomst');

    expect(() => bouwAcquisitieOpvolgRetryPlan({
      oorspronkelijkeCommandos: basis,
      resultaat: {
        ...resultaat(),
        uitkomsten: [{ operationKey: 'opvolg:post:1', geslaagd: true, foutcode: null }],
      },
      volgendePoging: 2,
    })).toThrow('Niet alle opvolgcommando’s');
  });

  it('weigert retry zonder fouten en na het maximum', () => {
    const basis = [commando('1')];
    expect(() => bouwAcquisitieOpvolgRetryPlan({
      oorspronkelijkeCommandos: basis,
      resultaat: {
        uitkomsten: [{ operationKey: 'opvolg:post:1', geslaagd: true, foutcode: null }],
        geslaagdAantal: 1,
        misluktAantal: 0,
      },
      volgendePoging: 2,
    })).toThrow('geen mislukte opvolgcommando’s');

    expect(() => bouwAcquisitieOpvolgRetryPlan({
      oorspronkelijkeCommandos: [commando('1'), commando('2')],
      resultaat: resultaat(),
      volgendePoging: 4,
    })).toThrow('Maximaal aantal opvolgpogingen is bereikt');
  });
});
