import { describe, expect, it } from 'vitest';
import type { BatchdocumentContract, PrintbatchContract } from './productiekernContract';
import { bepaalActieveProductiekernBatchdocumenten } from './productiekernBatchdocumentHerstel';

const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026081601', status: 'documenten_gegenereerd', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null, geannuleerdOp: null, annuleringsreden: null,
};

function document(documenttype: BatchdocumentContract['documenttype'], index: number): BatchdocumentContract {
  const bestandsnaam = `bestand-${index}.${documenttype === 'adreslabels' ? 'csv' : 'pdf'}`;
  const pad = `actor-1/batch-1/v1/attempt-1/${bestandsnaam}`;
  return {
    id: `doc-${index}`, batchId: 'batch-1', documentversie: 1, documenttype,
    bestandReferentie: `off-market-productie/${pad}`, status: 'actief',
    metadata: { bucket: 'off-market-productie', pad, bestandsnaam },
    createdAt: '2026-08-16T22:00:00Z', vervallenOp: null,
  };
}

const set = [
  document('adreslabels', 4),
  document('brieven_pdf', 3),
  document('batchvoorblad', 1),
  document('controlelijst', 2),
];

describe('bepaalActieveProductiekernBatchdocumenten', () => {
  it('herstelt exact de vier actuele geregistreerde documenten in vaste volgorde', () => {
    expect(bepaalActieveProductiekernBatchdocumenten({ batch, documenten: set })
      .map((item) => item.documenttype)).toEqual([
      'batchvoorblad', 'controlelijst', 'brieven_pdf', 'adreslabels',
    ]);
  });

  it('negeert een vervallen oudere documentversie', () => {
    const oud = { ...document('brieven_pdf', 9), id: 'oud', documentversie: 0, status: 'vervallen' as const, vervallenOp: '2026-08-16T21:00:00Z' };
    expect(bepaalActieveProductiekernBatchdocumenten({ batch, documenten: [...set, oud] })).toHaveLength(4);
  });

  it('blokkeert incomplete, dubbele en gemanipuleerde actieve documentsets', () => {
    expect(() => bepaalActieveProductiekernBatchdocumenten({ batch, documenten: set.slice(0, 3) }))
      .toThrow('exact vier actieve documenten');
    expect(() => bepaalActieveProductiekernBatchdocumenten({
      batch,
      documenten: [...set.slice(0, 3), { ...set[0], id: 'dubbel' }],
    })).toThrow('Batchdocumenttype dubbel');
    expect(() => bepaalActieveProductiekernBatchdocumenten({
      batch,
      documenten: [{ ...set[0], bestandReferentie: 'off-market-productie/ander-pad' }, ...set.slice(1)],
    })).toThrow('Storage-referentie wijkt af');
  });

  it('staat bij een concept-BAT alleen toe dat er nog geen actieve documentset bestaat', () => {
    const concept = { ...batch, status: 'concept' as const };
    expect(bepaalActieveProductiekernBatchdocumenten({ batch: concept, documenten: [] })).toEqual([]);
    expect(() => bepaalActieveProductiekernBatchdocumenten({ batch: concept, documenten: set }))
      .toThrow('onverwacht al actieve');
  });
});
