import { describe, expect, it, vi } from 'vitest';

import type {
  BriefContract,
  BriefversieContract,
  PrintbatchBriefContract,
  PrintbatchContract,
} from './productiekernContract';
import { laadProductiekernBatch } from './productiekernBatchLezer';

const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026081601', status: 'concept', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null,
  geannuleerdOp: null, annuleringsreden: null,
};
const brief: BriefContract = {
  id: 'brief-1', briefnummer: 'BR2026000001', signaalId: 'sig-1', selectieId: 'sel-1',
  objectId: null, relatieId: null, actieveVersie: 1, status: 'definitief',
  vervangingVanBriefId: null, definitiefOp: '2026-08-16T20:00:00Z',
  vergrendeldOp: '2026-08-16T20:00:00Z', annuleringsreden: null,
};
const versie: BriefversieContract = {
  id: 'versie-1', briefId: 'brief-1', versienummer: 1, status: 'actief',
  inhoud: { onderwerp: null, brieftekst: 'Tekst', objectadres: null, objectomschrijving: null, templateId: null, templateVersie: null },
  geadresseerde: { naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null, straatHuisnummer: 'Straat 1', postcode: '1012 AB', plaats: 'Amsterdam', land: 'Nederland', bron: 'test', verificatiestatus: 'geverifieerd', relatieId: null },
  bestandReferentie: null, createdAt: '2026-08-16T20:00:00Z', vervallenOp: null, verzondenOp: null,
};
const koppeling: PrintbatchBriefContract = {
  id: 'pb-1', batchId: 'batch-1', briefId: 'brief-1', briefVersieId: 'versie-1',
  verwijderdOp: null, afwijkingsstatus: null, afwijkingsreden: null,
};

function repo(overrides: Partial<{
  batch: PrintbatchContract | null;
  koppelingen: PrintbatchBriefContract[];
  brief: BriefContract | null;
  versies: BriefversieContract[];
}> = {}) {
  return {
    haalPrintbatch: vi.fn(async () => overrides.batch === undefined ? batch : overrides.batch),
    haalPrintbatchBrieven: vi.fn(async () => overrides.koppelingen ?? [koppeling]),
    haalBrief: vi.fn(async () => overrides.brief === undefined ? brief : overrides.brief),
    haalBriefversies: vi.fn(async () => overrides.versies ?? [versie]),
  };
}

describe('laadProductiekernBatch', () => {
  it('leest exact de actieve immutable versie terug en maakt een stabiele geadresseerdekey', async () => {
    const resultaat = await laadProductiekernBatch('batch-1', repo());
    expect(resultaat.batch).toEqual(batch);
    expect(resultaat.brieven).toHaveLength(1);
    expect(resultaat.brieven[0]).toMatchObject({
      brief: { id: 'brief-1', briefnummer: 'BR2026000001' },
      versie: { id: 'versie-1', versienummer: 1 },
      geadresseerdeKey: 'sig-1|versie-1',
    });
  });

  it('negeert verwijderde koppelingen maar blokkeert een lege actieve batch', async () => {
    await expect(laadProductiekernBatch('batch-1', repo({
      koppelingen: [{ ...koppeling, verwijderdOp: '2026-08-16T21:00:00Z' }],
    }))).rejects.toThrow('geen actieve briefkoppelingen');
  });

  it('blokkeert ontbrekende gekoppelde versie en versie-drift', async () => {
    await expect(laadProductiekernBatch('batch-1', repo({ versies: [] })))
      .rejects.toThrow('Gekoppelde briefversie');

    await expect(laadProductiekernBatch('batch-1', repo({
      brief: { ...brief, actieveVersie: 2 },
    }))).rejects.toThrow('versie-drift');
  });

  it('blokkeert dubbele brief- of versiekoppelingen vóór detailreads', async () => {
    const repository = repo({
      koppelingen: [koppeling, { ...koppeling, id: 'pb-2' }],
    });
    await expect(laadProductiekernBatch('batch-1', repository)).rejects.toThrow('dubbel gekoppeld');
    expect(repository.haalBrief).not.toHaveBeenCalled();
  });
});
