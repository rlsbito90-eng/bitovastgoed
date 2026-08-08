import { describe, expect, it } from 'vitest';

import type { BriefContract } from './productiekernContract';
import {
  bewaakBriefLeesIntegriteit,
  ProductiekernBriefLeesIntegriteitError,
} from './productiekernBriefLeesIntegriteit';

function brief(overrides: Partial<BriefContract> = {}): BriefContract {
  return {
    id: 'brief-1',
    briefnummer: null,
    signaalId: 'signaal-1',
    selectieId: 'selectie-1',
    objectId: null,
    relatieId: null,
    actieveVersie: null,
    status: 'concept',
    vervangingVanBriefId: null,
    definitiefOp: null,
    vergrendeldOp: null,
    annuleringsreden: null,
    ...overrides,
  };
}

describe('bewaakBriefLeesIntegriteit', () => {
  it('accepteert consistente concept-, definitieve en geannuleerde brieven', () => {
    expect(bewaakBriefLeesIntegriteit(brief()).status).toBe('concept');
    expect(bewaakBriefLeesIntegriteit(brief({
      status: 'definitief',
      briefnummer: 'BR2026000482',
      actieveVersie: 1,
      definitiefOp: '2026-08-06T12:00:00Z',
      vergrendeldOp: '2026-08-06T12:00:00Z',
    })).status).toBe('definitief');
    expect(bewaakBriefLeesIntegriteit(brief({
      status: 'geannuleerd',
      annuleringsreden: 'Dubbele brief',
    })).status).toBe('geannuleerd');
  });

  it('weigert productiestatus op een conceptbrief', () => {
    expect(() => bewaakBriefLeesIntegriteit(brief({
      briefnummer: 'BR2026000482',
    }))).toThrow(ProductiekernBriefLeesIntegriteitError);
    expect(() => bewaakBriefLeesIntegriteit(brief({
      vergrendeldOp: '2026-08-06T12:00:00Z',
    }))).toThrow('conceptbrief is ten onrechte definitief of vergrendeld');
  });

  it('weigert een onvolledige definitieve brief', () => {
    expect(() => bewaakBriefLeesIntegriteit(brief({
      status: 'definitief',
    }))).toThrow('definitieve brief mist een briefnummer');
    expect(() => bewaakBriefLeesIntegriteit(brief({
      status: 'definitief',
      briefnummer: 'BR2026000482',
      actieveVersie: 1,
    }))).toThrow('definitieve brief mist definitief- of vergrendeldatum');
  });

  it('weigert een geannuleerde brief zonder reden en ongeldige actieve versie', () => {
    expect(() => bewaakBriefLeesIntegriteit(brief({
      status: 'geannuleerd',
    }))).toThrow('geannuleerde brief mist een annuleringsreden');
    expect(() => bewaakBriefLeesIntegriteit(brief({
      actieveVersie: 0,
    }))).toThrow('actieve versie moet minimaal 1 zijn');
  });
});
