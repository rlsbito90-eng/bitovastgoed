import { describe, expect, it } from 'vitest';

import { bouwBatchVoorbladModel } from './batchVoorblad';
import type { BatchControlelijst } from './batchControlelijst';
import type { PrintbatchContract } from './productiekernContract';

const batch: PrintbatchContract = {
  id: 'batch-1',
  batchnummer: 'BAT2026080601',
  status: 'documenten_gegenereerd',
  documentversie: 1,
  aanvullingOpBatchId: null,
  printdatum: null,
  verzenddatum: null,
  geannuleerdOp: null,
  annuleringsreden: null,
};

function lijst(overrides: Partial<BatchControlelijst> = {}): BatchControlelijst {
  return {
    batchId: 'batch-1',
    batchnummer: 'BAT2026080601',
    documentversie: 1,
    totaal: 2,
    nietGeverifieerd: 0,
    pdfOntbreekt: 0,
    rijen: [],
    ...overrides,
  };
}

describe('bouwBatchVoorbladModel', () => {
  it('markeert een complete batch als gereed voor print', () => {
    expect(bouwBatchVoorbladModel(batch, lijst())).toEqual({
      batchnummer: 'BAT2026080601',
      documentversie: 1,
      status: 'documenten_gegenereerd',
      briefAantal: 2,
      nietGeverifieerdeAdressen: 0,
      ontbrekendePdfs: 0,
      gereedVoorPrint: true,
      waarschuwingen: [],
    });
  });

  it('toont concrete waarschuwingen en blokkeert printgereedheid', () => {
    const model = bouwBatchVoorbladModel(batch, lijst({
      nietGeverifieerd: 1,
      pdfOntbreekt: 2,
    }));

    expect(model.gereedVoorPrint).toBe(false);
    expect(model.waarschuwingen).toEqual([
      '1 adres(sen) zijn niet geverifieerd.',
      "2 brief-PDF('s) ontbreken.",
    ]);
  });

  it('weigert een controlelijst van een andere batch', () => {
    expect(() => bouwBatchVoorbladModel(batch, lijst({ batchId: 'batch-2' })))
      .toThrow('Controlelijst hoort niet bij de opgegeven printbatch.');
  });
});
