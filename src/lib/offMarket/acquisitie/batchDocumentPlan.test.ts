import { describe, expect, it } from 'vitest';

import { bouwBatchDocumentPlan } from './batchDocumentPlan';
import type { BriefversieContract, PrintbatchContract } from './productiekernContract';

const batch: PrintbatchContract = {
  id: 'batch-1',
  batchnummer: 'BAT2026080601',
  status: 'concept',
  documentversie: 1,
  aanvullingOpBatchId: null,
  printdatum: null,
  verzenddatum: null,
  geannuleerdOp: null,
  annuleringsreden: null,
};

function versie(id: string, naam: string): BriefversieContract {
  return {
    id,
    briefId: `brief-${id}`,
    versienummer: 1,
    status: 'actief',
    inhoud: {
      onderwerp: 'Voorstel',
      brieftekst: 'Geachte heer/mevrouw,',
      objectadres: 'Voorbeeldstraat 1',
      objectomschrijving: null,
      templateId: null,
      templateVersie: null,
    },
    geadresseerde: {
      naam,
      bedrijfsnaam: null,
      aanhef: null,
      straatHuisnummer: 'Teststraat 1',
      postcode: '1234 AB',
      plaats: 'Oisterwijk',
      land: 'Nederland',
      bron: 'test',
      verificatiestatus: 'handmatig_gecontroleerd',
      relatieId: null,
    },
    bestandReferentie: null,
    createdAt: '2026-08-06T08:00:00.000Z',
    vervallenOp: null,
    verzondenOp: null,
  };
}

describe('bouwBatchDocumentPlan', () => {
  it('maakt vier deterministische batchdocumenten', () => {
    const plan = bouwBatchDocumentPlan({
      batch,
      brieven: [
        { briefnummer: 'BR2026000002', versie: versie('v2', 'B') },
        { briefnummer: 'BR2026000001', versie: versie('v1', 'A') },
      ],
    });

    expect(plan.documenten.map(item => item.documenttype)).toEqual([
      'batchvoorblad',
      'controlelijst',
      'brieven_pdf',
      'adreslabels',
    ]);
    expect(plan.documenten[0].briefVersieIds).toEqual(['v1', 'v2']);
    expect(plan.documenten.map(item => item.bestandsnaam)).toEqual([
      'BAT2026080601-v1-voorblad.pdf',
      'BAT2026080601-v1-controlelijst.pdf',
      'BAT2026080601-v1-brieven.pdf',
      'BAT2026080601-v1-adreslabels.csv',
    ]);
  });

  it('weigert een lege batch', () => {
    expect(() => bouwBatchDocumentPlan({ batch, brieven: [] }))
      .toThrow('Een documentplan vereist minimaal één briefversie.');
  });

  it('weigert dubbele briefversies', () => {
    const dezelfde = versie('v1', 'A');
    expect(() => bouwBatchDocumentPlan({
      batch,
      brieven: [
        { briefnummer: 'BR2026000001', versie: dezelfde },
        { briefnummer: 'BR2026000001', versie: dezelfde },
      ],
    })).toThrow('Briefversie dubbel in batchdocumentplan: v1.');
  });

  it('weigert generatie nadat de batch is geprint', () => {
    expect(() => bouwBatchDocumentPlan({
      batch: { ...batch, status: 'geprint', printdatum: '2026-08-06' },
      brieven: [{ briefnummer: 'BR2026000001', versie: versie('v1', 'A') }],
    })).toThrow('Batchdocumenten mogen niet worden gegenereerd bij status geprint.');
  });

  it('weigert verzonden of vervallen briefversies', () => {
    const verzonden = {
      ...versie('v1', 'A'),
      status: 'verzonden' as const,
      verzondenOp: '2026-08-06T09:00:00.000Z',
    };
    expect(() => bouwBatchDocumentPlan({
      batch,
      brieven: [{ briefnummer: 'BR2026000001', versie: verzonden }],
    })).toThrow('Alleen actieve briefversies mogen in een nieuw documentplan: v1.');
  });
});
