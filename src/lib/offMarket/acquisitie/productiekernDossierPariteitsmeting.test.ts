import { describe, expect, it, vi } from 'vitest';

import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';
import { meetProductiekernDossierPariteit } from './productiekernDossierPariteitsmeting';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';

const legacyDossier: LegacyProductiedossierReadmodel = {
  dossier: {
    selectieId: 'selectie-1',
    signaalId: 'signaal-1',
    objectId: 'object-1',
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

function maakRepository(dossier: LegacyProductiedossierReadmodel['dossier'] | null): AcquisitieProductiekernRepository {
  return {
    haalDossier: vi.fn().mockResolvedValue(dossier),
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

describe('meetProductiekernDossierPariteit', () => {
  it('raadpleegt de repository niet zonder volledig leesbewijs', async () => {
    const repository = maakRepository(legacyDossier.dossier);

    const resultaat = await meetProductiekernDossierPariteit({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: undefined,
      achterliggendeRepository: repository,
    });

    expect(resultaat.status).toBe('niet_geactiveerd');
    expect(resultaat.vergelijking).toBeNull();
    expect(resultaat.waarschuwingen).toHaveLength(6);
    expect(repository.haalDossier).not.toHaveBeenCalled();
  });

  it('rapporteert een ontbrekend productiekern-dossier afzonderlijk', async () => {
    const resultaat = await meetProductiekernDossierPariteit({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: maakRepository(null),
    });

    expect(resultaat.status).toBe('productiekern_dossier_ontbreekt');
    expect(resultaat.vergelijking).toBeNull();
  });

  it('rapporteert volledige pariteit', async () => {
    const resultaat = await meetProductiekernDossierPariteit({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: maakRepository({ ...legacyDossier.dossier }),
    });

    expect(resultaat.status).toBe('gelijk');
    expect(resultaat.vergelijking).toMatchObject({
      gelijk: true,
      kritiekeAfwijking: false,
      afwijkingen: [],
    });
  });

  it('onderscheidt procesafwijking van kritieke identiteitafwijking', async () => {
    const procesResultaat = await meetProductiekernDossierPariteit({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: maakRepository({
        ...legacyDossier.dossier,
        primaireWerkbak: 'eigenaar_achterhalen',
      }),
    });

    expect(procesResultaat.status).toBe('procesafwijking');
    expect(procesResultaat.vergelijking?.kritiekeAfwijking).toBe(false);

    const kritiekResultaat = await meetProductiekernDossierPariteit({
      selectieId: 'selectie-1',
      legacyDossier,
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: maakRepository({
        ...legacyDossier.dossier,
        signaalId: 'signaal-2',
      }),
    });

    expect(kritiekResultaat.status).toBe('kritieke_afwijking');
    expect(kritiekResultaat.vergelijking?.kritiekeAfwijking).toBe(true);
    expect(kritiekResultaat.waarschuwingen[0]).toMatch(/Kritieke identiteitafwijking/);
  });
});
