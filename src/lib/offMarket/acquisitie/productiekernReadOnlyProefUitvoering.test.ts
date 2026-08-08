import { describe, expect, it, vi } from 'vitest';

import type { LegacyProductiedossierReadmodel } from './legacyProductiedossierReadmodel';
import { voerProductiekernReadOnlyProefUit } from './productiekernReadOnlyProefUitvoering';
import type { AcquisitieProductiekernRepository } from './productiekernRepository';

const volledigLeesbewijs = {
  actueleDdlGeverifieerd: true,
  actueleRlsGeverifieerd: true,
  geisoleerdeMigratieproefGroen: true,
  gerichteReadmodelTestsGroen: true,
  productiebuildGroen: true,
  explicietLeesakkoord: true,
};

function maakLegacyDossier(selectieId: string): LegacyProductiedossierReadmodel {
  return {
    dossier: {
      selectieId,
      signaalId: `signaal-${selectieId}`,
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
}

function maakRepository(
  dossiers: Record<string, LegacyProductiedossierReadmodel['dossier'] | null>,
): AcquisitieProductiekernRepository {
  return {
    haalDossier: vi.fn(async (selectieId: string) => dossiers[selectieId] ?? null),
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

const eisen = {
  minimaalAantalMetingen: 2,
  maximaalAandeelProcesafwijkingen: 0.5,
};

describe('voerProductiekernReadOnlyProefUit', () => {
  it('bouwt metingen, rapport en besluit in één read-only uitvoering', async () => {
    const legacy1 = maakLegacyDossier('selectie-1');
    const legacy2 = maakLegacyDossier('selectie-2');
    const repository = maakRepository({
      'selectie-1': legacy1.dossier,
      'selectie-2': {
        ...legacy2.dossier,
        primaireWerkbak: 'eigenaar_achterhalen',
      },
    });

    const resultaat = await voerProductiekernReadOnlyProefUit({
      dossiers: [
        { selectieId: 'selectie-1', legacyDossier: legacy1 },
        { selectieId: 'selectie-2', legacyDossier: legacy2 },
      ],
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: repository,
      eisen,
    });

    expect(resultaat.regels.map(({ meting }) => meting.status)).toEqual([
      'gelijk',
      'procesafwijking',
    ]);
    expect(resultaat.rapport).toMatchObject({
      totaal: 2,
      veiligVoorReadOnlyProef: true,
    });
    expect(resultaat.besluit).toEqual({
      toegestaan: true,
      blokkades: [],
      aandeelProcesafwijkingen: 0.5,
    });
    expect(repository.haalDossier).toHaveBeenNthCalledWith(1, 'selectie-1');
    expect(repository.haalDossier).toHaveBeenNthCalledWith(2, 'selectie-2');
    expect(repository.reserveerBrief).not.toHaveBeenCalled();
  });

  it('blijft volledig fail-closed zonder leesbewijs', async () => {
    const legacy = maakLegacyDossier('selectie-1');
    const repository = maakRepository({ 'selectie-1': legacy.dossier });

    const resultaat = await voerProductiekernReadOnlyProefUit({
      dossiers: [{ selectieId: 'selectie-1', legacyDossier: legacy }],
      bewijs: undefined,
      achterliggendeRepository: repository,
      eisen: { minimaalAantalMetingen: 1, maximaalAandeelProcesafwijkingen: 0 },
    });

    expect(resultaat.regels[0].meting.status).toBe('niet_geactiveerd');
    expect(resultaat.rapport.veiligVoorReadOnlyProef).toBe(false);
    expect(resultaat.besluit.toegestaan).toBe(false);
    expect(repository.haalDossier).not.toHaveBeenCalled();
  });

  it('blokkeert het proefbesluit bij een ontbrekend productiekern-dossier', async () => {
    const legacy = maakLegacyDossier('selectie-1');
    const repository = maakRepository({ 'selectie-1': null });

    const resultaat = await voerProductiekernReadOnlyProefUit({
      dossiers: [{ selectieId: 'selectie-1', legacyDossier: legacy }],
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: repository,
      eisen: { minimaalAantalMetingen: 1, maximaalAandeelProcesafwijkingen: 1 },
    });

    expect(resultaat.regels[0].meting.status)
      .toBe('productiekern_dossier_ontbreekt');
    expect(resultaat.rapport.ontbrekendeSelectieIds).toEqual(['selectie-1']);
    expect(resultaat.besluit.toegestaan).toBe(false);
  });

  it('weigert dubbele selectie-ID’s vóór de eerste repository-read', async () => {
    const legacy = maakLegacyDossier('selectie-1');
    const repository = maakRepository({ 'selectie-1': legacy.dossier });

    await expect(voerProductiekernReadOnlyProefUit({
      dossiers: [
        { selectieId: 'selectie-1', legacyDossier: legacy },
        { selectieId: 'selectie-1', legacyDossier: legacy },
      ],
      bewijs: volledigLeesbewijs,
      achterliggendeRepository: repository,
      eisen,
    })).rejects.toThrow('Selectie selectie-1 komt dubbel voor');

    expect(repository.haalDossier).not.toHaveBeenCalled();
  });
});
