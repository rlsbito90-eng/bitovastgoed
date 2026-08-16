import { describe, expect, it, vi } from 'vitest';
import type { BriefContract, BriefversieContract, PrintbatchContract } from './productiekernContract';
import { markeerProductiekernBrievenGepost } from './productiekernPrintbatch';

const basisBrief: BriefContract = {
  id: 'brief-1', briefnummer: 'BR2026000001', signaalId: 'sig-1', selectieId: 'sel-1',
  objectId: null, relatieId: null, actieveVersie: 1, status: 'definitief',
  vervangingVanBriefId: null, definitiefOp: '2026-08-16T20:00:00Z',
  vergrendeldOp: '2026-08-16T20:00:00Z', annuleringsreden: null,
};
const basisVersie: BriefversieContract = {
  id: 'v1', briefId: 'brief-1', versienummer: 1, status: 'actief',
  inhoud: { onderwerp: null, brieftekst: 'Tekst', objectadres: null, objectomschrijving: null, templateId: null, templateVersie: null },
  geadresseerde: { naam: 'Eigenaar', bedrijfsnaam: null, aanhef: null, straatHuisnummer: 'Straat 1', postcode: '1012 AB', plaats: 'Amsterdam', land: 'Nederland', bron: 'test', verificatiestatus: 'geverifieerd', relatieId: null },
  bestandReferentie: null, createdAt: '2026-08-16T20:00:00Z', vervallenOp: null, verzondenOp: null,
};
const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026081601', status: 'gedeeltelijk_gepost', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: '2026-08-16T21:00:00Z',
  verzenddatum: '2026-08-16T22:00:00Z', geannuleerdOp: null, annuleringsreden: null,
};

function tx() {
  return {
    maakBriefDefinitief: vi.fn(), registreerBatchdocumenten: vi.fn(), markeerBatchGeprint: vi.fn(),
    markeerBriefGepost: vi.fn(async () => undefined),
  };
}

describe('gedeeltelijke postretry', () => {
  it('slaat reeds verzonden immutable versies over en schrijft alleen de resterende brief', async () => {
    const verzonden = { ...basisVersie, status: 'verzonden' as const, verzondenOp: '2026-08-16T22:00:00Z' };
    const brief2 = { ...basisBrief, id: 'brief-2', briefnummer: 'BR2026000002' };
    const versie2 = { ...basisVersie, id: 'v2', briefId: 'brief-2' };
    const repo = tx();

    await markeerProductiekernBrievenGepost({
      batch,
      brieven: [
        { brief: basisBrief, versie: verzonden, geadresseerdeKey: 'sig-1|v1' },
        { brief: brief2, versie: versie2, geadresseerdeKey: 'sig-1|v2' },
      ],
      actorId: 'actor-1',
      verzenddatum: '2026-08-16T22:05:00Z',
    }, repo);

    expect(repo.markeerBriefGepost).toHaveBeenCalledTimes(1);
    expect(repo.markeerBriefGepost).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'brief-gepost:batch-1:v2',
      actieveVersie: expect.objectContaining({ id: 'v2', status: 'actief' }),
    }));
  });
});
