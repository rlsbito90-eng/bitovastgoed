import { describe, expect, it, vi } from 'vitest';

import type { BriefContract, BriefversieContract, PrintbatchContract } from './productiekernContract';
import { laadProductiekernBatch } from './productiekernBatchLezer';

const brief: BriefContract = {
  id: 'brief-1', briefnummer: 'BR2026000001', signaalId: 'sig-1', selectieId: 'sel-1',
  objectId: null, relatieId: null, actieveVersie: 1, status: 'definitief',
  vervangingVanBriefId: null, definitiefOp: '2026-08-16T20:00:00Z',
  vergrendeldOp: '2026-08-16T20:00:00Z', annuleringsreden: null,
};
const verzonden: BriefversieContract = {
  id: 'versie-1', briefId: brief.id, versienummer: 1, status: 'verzonden',
  inhoud: { onderwerp: null, brieftekst: 'Tekst', objectadres: null, objectomschrijving: null, templateId: null, templateVersie: null },
  geadresseerde: { naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null, straatHuisnummer: 'Straat 1', postcode: '1012 AB', plaats: 'Amsterdam', land: 'Nederland', bron: 'test', verificatiestatus: 'geverifieerd', relatieId: null },
  bestandReferentie: null, createdAt: '2026-08-16T20:00:00Z', vervallenOp: null,
  verzondenOp: '2026-08-16T22:00:00Z',
};

function repo(batch: PrintbatchContract, versie: BriefversieContract) {
  return {
    haalPrintbatch: vi.fn(async () => batch),
    haalPrintbatchBrieven: vi.fn(async () => [{
      id: 'pb-1', batchId: batch.id, briefId: brief.id, briefVersieId: versie.id,
      verwijderdOp: null, afwijkingsstatus: null, afwijkingsreden: null,
    }]),
    haalBrief: vi.fn(async () => brief),
    haalBriefversies: vi.fn(async () => [versie]),
  };
}

describe('BAT-herstel na fysieke lifecycle', () => {
  it('herstelt dezelfde immutable verzonden versie wanneer de BAT volledig gepost is', async () => {
    const batch: PrintbatchContract = {
      id: 'batch-1', batchnummer: 'BAT2026081601', status: 'gepost', documentversie: 1,
      aanvullingOpBatchId: null, printdatum: '2026-08-16T21:00:00Z',
      verzenddatum: '2026-08-16T22:00:00Z', geannuleerdOp: null, annuleringsreden: null,
    };
    const geladen = await laadProductiekernBatch(batch.id, repo(batch, verzonden));
    expect(geladen.brieven[0].versie).toMatchObject({ id: 'versie-1', status: 'verzonden' });
  });

  it('blokkeert een verzonden versie wanneer de BAT administratief nog slechts geprint is', async () => {
    const batch: PrintbatchContract = {
      id: 'batch-1', batchnummer: 'BAT2026081601', status: 'geprint', documentversie: 1,
      aanvullingOpBatchId: null, printdatum: '2026-08-16T21:00:00Z',
      verzenddatum: null, geannuleerdOp: null, annuleringsreden: null,
    };
    await expect(laadProductiekernBatch(batch.id, repo(batch, verzonden)))
      .rejects.toThrow('verzonden briefversies vóór een poststatus');
  });
});
