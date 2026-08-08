import { describe, expect, it, vi } from 'vitest';

import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';
import { leesProductiedossierMetBewijs } from './productiekernDualReadSamenstelling';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';

const legacyDossier: LegacyProductiedossierReadmodel = {
  dossier: {
    selectieId: 'selectie-1',
    signaalId: 'signaal-1',
    objectId: null,
    verwerkingGestartOp: null,
    verwerkingGestartDoor: null,
    primaireWerkbak: 'nieuwe_selectie',
    volgendeActieOp: null,
    volgendeActieOmschrijving: null,
  },
  brieven: [],
  losgekoppeldeAudit: [],
  waarschuwingen: [],
  bron: 'legacy_productie_export',
};

const volledigLeesbewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  gerichteReadmodelTestsGroen: true,
  productiebuildGroen: true,
  explicietLeesakkoord: true,
};

function maakRepository(): AcquisitieProductiekernRepository {
  return {
    haalDossier: vi.fn().mockResolvedValue({
      ...legacyDossier.dossier,
      primaireWerkbak: 'eigenaar_achterhalen',
    }),
    haalBrief: vi.fn().mockResolvedValue(null),
    haalBriefversies: vi.fn().mockResolvedValue([]),
    haalPrintbatch: vi.fn().mockResolvedValue(null),
    startVerwerking: vi.fn(),
    reserveerBrief: vi.fn(),
    maakBriefversie: vi.fn(),
    maakPrintbatch: vi.fn(),
    voegBriefversieToeAanBatch: vi.fn(),
    markeerBatchGeprint: vi.fn(),
    markeerBriefGepost: vi.fn(),
  };
}

describe('leesProductiedossierMetBewijs', () => {
  it('houdt legacy leidend en raakt de repository niet aan zonder volledig bewijs', async () => {
    const repository = maakRepository();

    const resultaat = await leesProductiedossierMetBewijs({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: undefined,
      achterliggendeRepository: repository,
    });

    expect(resultaat.bron).toBe('legacy');
    expect(resultaat.dossier).toBe(legacyDossier);
    expect(repository.haalDossier).not.toHaveBeenCalled();
  });

  it('weigert productiekern-lezen wanneer één bewijs ontbreekt', async () => {
    const repository = maakRepository();

    const resultaat = await leesProductiedossierMetBewijs({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: {
        ...volledigLeesbewijs,
        actueleRlsGeverifieerd: false,
      },
      achterliggendeRepository: repository,
    });

    expect(resultaat.bron).toBe('legacy');
    expect(repository.haalDossier).not.toHaveBeenCalled();
  });

  it('kiest de productiekern uitsluitend bij volledig groen bewijs', async () => {
    const repository = maakRepository();

    const resultaat = await leesProductiedossierMetBewijs({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: repository,
    });

    expect(resultaat.bron).toBe('productiekern');
    expect(resultaat.dossier.dossier.primaireWerkbak).toBe('eigenaar_achterhalen');
    expect(repository.haalDossier).toHaveBeenCalledWith('selectie-1');
    expect(repository.reserveerBrief).not.toHaveBeenCalled();
  });
});
