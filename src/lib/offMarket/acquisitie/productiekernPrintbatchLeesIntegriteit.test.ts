import { describe, expect, it } from 'vitest';

import type { PrintbatchContract } from './productiekernContract';
import {
  bewaakPrintbatchLeesIntegriteit,
  ProductiekernPrintbatchLeesIntegriteitError,
} from './productiekernPrintbatchLeesIntegriteit';

function batch(overrides: Partial<PrintbatchContract> = {}): PrintbatchContract {
  return {
    id: 'batch-1',
    batchnummer: 'BAT2026080601',
    status: 'concept',
    documentversie: 1,
    aanvullingOpBatchId: null,
    printdatum: null,
    verzenddatum: null,
    geannuleerdOp: null,
    annuleringsreden: null,
    ...overrides,
  };
}

describe('bewaakPrintbatchLeesIntegriteit', () => {
  it('accepteert consistente concept-, geprinte, geposte en geannuleerde batches', () => {
    expect(bewaakPrintbatchLeesIntegriteit(batch()).status).toBe('concept');
    expect(bewaakPrintbatchLeesIntegriteit(batch({
      status: 'geprint',
      printdatum: '2026-08-06',
    })).status).toBe('geprint');
    expect(bewaakPrintbatchLeesIntegriteit(batch({
      status: 'gepost',
      printdatum: '2026-08-06',
      verzenddatum: '2026-08-07',
    })).status).toBe('gepost');
    expect(bewaakPrintbatchLeesIntegriteit(batch({
      status: 'geannuleerd',
      geannuleerdOp: '2026-08-06T12:00:00Z',
      annuleringsreden: 'Batch vervangen',
    })).status).toBe('geannuleerd');
  });

  it('weigert verzending zonder printdatum en productievelden op concept', () => {
    expect(() => bewaakPrintbatchLeesIntegriteit(batch({
      verzenddatum: '2026-08-07',
    }))).toThrow(ProductiekernPrintbatchLeesIntegriteitError);
    expect(() => bewaakPrintbatchLeesIntegriteit(batch({
      printdatum: '2026-08-06',
    }))).toThrow('conceptbatch bevat al productie- of verzenddatums');
  });

  it('weigert geprint of gepost zonder vereiste datums', () => {
    expect(() => bewaakPrintbatchLeesIntegriteit(batch({
      status: 'geprint',
    }))).toThrow('geprinte batch mist printdatum');
    expect(() => bewaakPrintbatchLeesIntegriteit(batch({
      status: 'gepost',
      printdatum: '2026-08-06',
    }))).toThrow('geposte batch mist print- of verzenddatum');
  });

  it('weigert ongeldige documentversie en inconsistente annuleringsvelden', () => {
    expect(() => bewaakPrintbatchLeesIntegriteit(batch({
      documentversie: 0,
    }))).toThrow('documentversie moet minimaal 1 zijn');
    expect(() => bewaakPrintbatchLeesIntegriteit(batch({
      status: 'geannuleerd',
    }))).toThrow('geannuleerde batch mist datum of reden');
    expect(() => bewaakPrintbatchLeesIntegriteit(batch({
      annuleringsreden: 'Onterecht aanwezig',
    }))).toThrow('actieve batch bevat annuleringsvelden');
  });
});
