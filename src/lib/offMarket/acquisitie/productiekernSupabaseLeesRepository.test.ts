import { describe, expect, it, vi } from 'vitest';

import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import {
  SupabaseProductiekernLeesRepository,
  type ProductiekernSupabaseLeesTransport,
} from './productiekernSupabaseLeesRepository';

function transport(): ProductiekernSupabaseLeesTransport {
  return {
    haalEen: vi.fn(async (tabel) => {
      if (tabel === 'off_market_acquisitie_dossiers') {
        return {
          selectie_id: 'selectie-1', signaal_id: 'signaal-1', object_id: null,
          verwerking_gestart_op: null, verwerking_gestart_door: null,
          primaire_werkbak: 'nieuwe_selectie', volgende_actie_op: null,
          volgende_actie_omschrijving: null,
        };
      }
      if (tabel === 'off_market_brieven') {
        return {
          id: 'brief-1', briefnummer: null, signaal_id: 'signaal-1',
          selectie_id: 'selectie-1', object_id: null, relatie_id: null,
          actieve_versie: null, status: 'concept', vervanging_van_brief_id: null,
          definitief_op: null, vergrendeld_op: null, annuleringsreden: null,
        };
      }
      if (tabel === 'off_market_printbatches') {
        return {
          id: 'batch-1', batchnummer: 'BAT2026080601', status: 'concept',
          documentversie: 1, aanvulling_op_batch_id: null, printdatum: null,
          verzenddatum: null, geannuleerd_op: null, annuleringsreden: null,
        };
      }
      return null;
    }),
    haalMeerdere: vi.fn(async () => [{
      id: 'versie-1', brief_id: 'brief-1', versienummer: 1, status: 'actief',
      inhoud_snapshot: { brieftekst: 'Tekst' },
      geadresseerde_snapshot: { naam: 'Eigenaar' }, bestand_referentie: null,
      created_at: '2026-08-06T12:00:00Z', vervallen_op: null, verzonden_op: null,
    }]),
  };
}

describe('SupabaseProductiekernLeesRepository', () => {
  it('leest de vier productiekern-readmodels via vaste tabel- en filtercontracten', async () => {
    const t = transport();
    const repository = new SupabaseProductiekernLeesRepository(t);

    await expect(repository.haalDossier('selectie-1')).resolves.toMatchObject({ selectieId: 'selectie-1' });
    await expect(repository.haalBrief('brief-1')).resolves.toMatchObject({ id: 'brief-1' });
    await expect(repository.haalBriefversies('brief-1')).resolves.toHaveLength(1);
    await expect(repository.haalPrintbatch('batch-1')).resolves.toMatchObject({ id: 'batch-1' });

    expect(t.haalEen).toHaveBeenNthCalledWith(
      1, 'off_market_acquisitie_dossiers', { selectie_id: 'selectie-1' },
    );
    expect(t.haalMeerdere).toHaveBeenCalledWith(
      'off_market_brief_versies',
      { brief_id: 'brief-1' },
      { kolom: 'versienummer', oplopend: true },
    );
  });

  it('geeft null door wanneer een enkel record niet bestaat', async () => {
    const t: ProductiekernSupabaseLeesTransport = {
      haalEen: vi.fn(async () => null),
      haalMeerdere: vi.fn(async () => []),
    };
    const repository = new SupabaseProductiekernLeesRepository(t);

    await expect(repository.haalDossier('ontbreekt')).resolves.toBeNull();
    await expect(repository.haalBriefversies('ontbreekt')).resolves.toEqual([]);
  });

  it('houdt historische verstuurde brieven buiten de formele productiekern', async () => {
    const t: ProductiekernSupabaseLeesTransport = {
      haalEen: vi.fn(async () => ({
        id: 'legacy-verstuurd', briefnummer: null, signaal_id: 'signaal-1',
        selectie_id: null, object_id: null, relatie_id: null,
        actieve_versie: null, status: 'verstuurd', vervanging_van_brief_id: null,
        definitief_op: null, vergrendeld_op: null, annuleringsreden: null,
      })),
      haalMeerdere: vi.fn(async () => []),
    };
    const repository = new SupabaseProductiekernLeesRepository(t);

    await expect(repository.haalBrief('legacy-verstuurd')).resolves.toBeNull();
  });

  it('houdt legacy conceptbrieven zonder selectie_id buiten de formele productiekern', async () => {
    const t: ProductiekernSupabaseLeesTransport = {
      haalEen: vi.fn(async () => ({
        id: 'legacy-concept', briefnummer: null, signaal_id: 'signaal-1',
        selectie_id: null, object_id: null, relatie_id: null,
        actieve_versie: null, status: 'concept', vervanging_van_brief_id: null,
        definitief_op: null, vergrendeld_op: null, annuleringsreden: null,
      })),
      haalMeerdere: vi.fn(async () => []),
    };
    const repository = new SupabaseProductiekernLeesRepository(t);

    await expect(repository.haalBrief('legacy-concept')).resolves.toBeNull();
  });

  it('blokkeert alle zeven schrijfmethoden zonder het transport te benaderen', async () => {
    const t = transport();
    const repository = new SupabaseProductiekernLeesRepository(t);
    const acties = [
      () => repository.startVerwerking({ selectieId: 's', actorId: 'a', operationKey: 'o' }),
      () => repository.reserveerBrief({ selectieId: 's', signaalId: 'g', actorId: 'a', operationKey: 'o', jaar: 2026 }),
      () => repository.maakBriefversie({ briefId: 'b', actorId: 'a', operationKey: 'o', inhoudSnapshot: {}, geadresseerdeSnapshot: {} }),
      () => repository.maakPrintbatch({ actorId: 'a', operationKey: 'o', datum: '2026-08-06' }),
      () => repository.voegBriefversieToeAanBatch({ batchId: 'x', briefId: 'b', briefVersieId: 'v', actorId: 'a', operationKey: 'o' }),
      () => repository.markeerBatchGeprint({ batchId: 'x', actorId: 'a', operationKey: 'o', printdatum: '2026-08-06' }),
      () => repository.markeerBriefGepost({ briefId: 'b', briefVersieId: 'v', batchId: 'x', actorId: 'a', operationKey: 'o', verzenddatum: '2026-08-06' }),
    ];

    for (const actie of acties) {
      await expect(actie()).rejects.toBeInstanceOf(ProductiekernNietGeactiveerdError);
    }
    expect(t.haalEen).not.toHaveBeenCalled();
    expect(t.haalMeerdere).not.toHaveBeenCalled();
  });
});
