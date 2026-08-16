import { describe, expect, it, vi } from 'vitest';

import { ProductiekernNietGeactiveerdError } from './productiekernRepository';
import {
  SupabaseProductiekernLeesRepository,
  type ProductiekernSupabaseLeesTransport,
} from './productiekernSupabaseLeesRepository';

function transport(): ProductiekernSupabaseLeesTransport {
  return {
    haalEen: vi.fn(async (tabel) => {
      if (tabel === 'off_market_acquisitie_dossiers') return {
        selectie_id: 'selectie-1', signaal_id: 'signaal-1', object_id: null,
        verwerking_gestart_op: null, verwerking_gestart_door: null,
        primaire_werkbak: 'nieuwe_selectie', volgende_actie_op: null, volgende_actie_omschrijving: null,
      };
      if (tabel === 'off_market_brieven') return {
        id: 'brief-1', briefnummer: null, signaal_id: 'signaal-1', selectie_id: 'selectie-1',
        object_id: null, relatie_id: null, actieve_versie: null, status: 'concept',
        vervanging_van_brief_id: null, definitief_op: null, vergrendeld_op: null, annuleringsreden: null,
      };
      if (tabel === 'off_market_printbatches') return {
        id: 'batch-1', batchnummer: 'BAT2026080601', status: 'concept', documentversie: 1,
        aanvulling_op_batch_id: null, printdatum: null, verzenddatum: null, geannuleerd_op: null, annuleringsreden: null,
      };
      return null;
    }),
    haalMeerdere: vi.fn(async (tabel) => {
      if (tabel === 'off_market_printbatch_brieven') return [
        { id: 'koppeling-1', batch_id: 'batch-1', brief_id: 'brief-1', brief_versie_id: 'versie-1', verwijderd_op: null, afwijkingsstatus: null, afwijkingsreden: null, created_at: '2026-08-06T12:05:00Z' },
        { id: 'koppeling-verwijderd', batch_id: 'batch-1', brief_id: 'brief-oud', brief_versie_id: 'versie-oud', verwijderd_op: '2026-08-06T12:06:00Z', afwijkingsstatus: null, afwijkingsreden: null, created_at: '2026-08-06T12:04:00Z' },
      ];
      if (tabel === 'off_market_batchdocumenten') return [{
        id: 'doc-1', batch_id: 'batch-1', documentversie: 1, documenttype: 'brieven_pdf',
        bestand_referentie: 'off-market-productie/actor/batch-1/v1/a/brieven.pdf', status: 'actief',
        metadata: { bucket: 'off-market-productie', pad: 'actor/batch-1/v1/a/brieven.pdf', bestandsnaam: 'brieven.pdf' },
        created_at: '2026-08-06T12:06:00Z', vervallen_op: null,
      }];
      return [{
        id: 'versie-1', brief_id: 'brief-1', versienummer: 1, status: 'actief',
        inhoud_snapshot: { brieftekst: 'Tekst' }, geadresseerde_snapshot: { naam: 'Eigenaar' },
        bestand_referentie: null, created_at: '2026-08-06T12:00:00Z', vervallen_op: null, verzonden_op: null,
      }];
    }),
    haalMeerdereOpIds: vi.fn(async () => []),
  };
}

describe('SupabaseProductiekernLeesRepository', () => {
  it('leest de zes productiekern-readmodels via vaste tabel- en filtercontracten', async () => {
    const t = transport();
    const repository = new SupabaseProductiekernLeesRepository(t);

    await expect(repository.haalDossier('selectie-1')).resolves.toMatchObject({ selectieId: 'selectie-1' });
    await expect(repository.haalBrief('brief-1')).resolves.toMatchObject({ id: 'brief-1' });
    await expect(repository.haalBriefversies('brief-1')).resolves.toHaveLength(1);
    await expect(repository.haalPrintbatch('batch-1')).resolves.toMatchObject({ id: 'batch-1' });
    await expect(repository.haalPrintbatchBrieven('batch-1')).resolves.toEqual([
      expect.objectContaining({ id: 'koppeling-1', batchId: 'batch-1', briefVersieId: 'versie-1' }),
    ]);
    await expect(repository.haalBatchdocumenten('batch-1')).resolves.toEqual([
      expect.objectContaining({ id: 'doc-1', batchId: 'batch-1', documenttype: 'brieven_pdf' }),
    ]);

    expect(t.haalEen).toHaveBeenNthCalledWith(1, 'off_market_acquisitie_dossiers', { selectie_id: 'selectie-1' });
    expect(t.haalMeerdere).toHaveBeenCalledWith('off_market_brief_versies', { brief_id: 'brief-1' }, { kolom: 'versienummer', oplopend: true });
    expect(t.haalMeerdere).toHaveBeenCalledWith('off_market_printbatch_brieven', { batch_id: 'batch-1' }, { kolom: 'created_at', oplopend: true });
    expect(t.haalMeerdere).toHaveBeenCalledWith('off_market_batchdocumenten', { batch_id: 'batch-1' }, { kolom: 'created_at', oplopend: true });
  });

  it('geeft null of een lege lijst door wanneer een record niet bestaat', async () => {
    const t: ProductiekernSupabaseLeesTransport = { haalEen: vi.fn(async () => null), haalMeerdere: vi.fn(async () => []), haalMeerdereOpIds: vi.fn(async () => []) };
    const repository = new SupabaseProductiekernLeesRepository(t);
    await expect(repository.haalDossier('ontbreekt')).resolves.toBeNull();
    await expect(repository.haalBriefversies('ontbreekt')).resolves.toEqual([]);
    await expect(repository.haalPrintbatchBrieven('ontbreekt')).resolves.toEqual([]);
    await expect(repository.haalBatchdocumenten('ontbreekt')).resolves.toEqual([]);
  });

  it('weigert een batchbriefkoppeling die bij een andere batch hoort', async () => {
    const t: ProductiekernSupabaseLeesTransport = {
      haalEen: vi.fn(async () => null),
      haalMeerdere: vi.fn(async () => [{ id: 'koppeling-1', batch_id: 'batch-anders', brief_id: 'brief-1', brief_versie_id: 'versie-1', verwijderd_op: null, afwijkingsstatus: null, afwijkingsreden: null, created_at: '2026-08-06T12:05:00Z' }]),
    };
    await expect(new SupabaseProductiekernLeesRepository(t).haalPrintbatchBrieven('batch-1')).rejects.toThrow();
  });

  it('houdt historische verstuurde en ongekoppelde legacy brieven buiten de formele productiekern', async () => {
    for (const rij of [
      { id: 'legacy-verstuurd', briefnummer: null, signaal_id: 'signaal-1', selectie_id: null, object_id: null, relatie_id: null, actieve_versie: null, status: 'verstuurd', vervanging_van_brief_id: null, definitief_op: null, vergrendeld_op: null, annuleringsreden: null },
      { id: 'legacy-concept', briefnummer: null, signaal_id: 'signaal-1', selectie_id: null, object_id: null, relatie_id: null, actieve_versie: null, status: 'concept', vervanging_van_brief_id: null, definitief_op: null, vergrendeld_op: null, annuleringsreden: null },
    ]) {
      const t: ProductiekernSupabaseLeesTransport = { haalEen: vi.fn(async () => rij), haalMeerdere: vi.fn(async () => []) };
      await expect(new SupabaseProductiekernLeesRepository(t).haalBrief(rij.id)).resolves.toBeNull();
    }
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
    for (const actie of acties) await expect(actie()).rejects.toBeInstanceOf(ProductiekernNietGeactiveerdError);
  });
});
