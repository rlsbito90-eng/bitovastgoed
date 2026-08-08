import { describe, expect, it, vi } from 'vitest';
import { productiekernStandaardUitgeschakeld } from './productieActivatiePoort';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';
import { maakVroegeProductieSupabaseRepository } from './vroegeProductieSupabaseRepository';

const actief = { lezenActief: true, schrijvenActief: true, ontbrekendBewijs: [] };
const tijd = '2026-08-08T12:00:00.000Z';

describe('maakVroegeProductieSupabaseRepository', () => {
  it('blokkeert vóór transport wanneer de centrale schrijfpoort dicht is', async () => {
    const rpc = vi.fn();
    const repo = maakVroegeProductieSupabaseRepository({
      activatie: productiekernStandaardUitgeschakeld,
      uitvoerder: { rpc },
      klok: () => tijd,
    });

    await expect(repo.startVerwerking({ selectieId: 's', actorId: 'a', operationKey: 'o' }))
      .rejects.toBeInstanceOf(ProductieTransactiesNietGeactiveerdError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('mapt start verwerking en briefreservering exact naar de vroege RPC-contracten', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ selectie_id: 'sel-1', signaal_id: 'sig-1' }], error: null })
      .mockResolvedValueOnce({ data: [{ brief_id: 'brief-1', signaal_id: 'sig-1' }], error: null });
    const repo = maakVroegeProductieSupabaseRepository({ activatie: actief, uitvoerder: { rpc }, klok: () => tijd });

    await expect(repo.startVerwerking({ selectieId: 'sel-1', actorId: 'actor-1', operationKey: 'start-1' }))
      .resolves.toMatchObject({ selectieId: 'sel-1', signaalId: 'sig-1', verwerkingGestartOp: tijd, primaireWerkbak: 'eigenaar_achterhalen' });
    await expect(repo.reserveerBrief({ selectieId: 'sel-1', signaalId: 'sig-1', actorId: 'actor-1', operationKey: 'brief-1', jaar: 2026 }))
      .resolves.toMatchObject({ id: 'brief-1', selectieId: 'sel-1', signaalId: 'sig-1', status: 'concept' });

    expect(rpc).toHaveBeenNthCalledWith(1, 'off_market_verwerking_starten', {
      p_selectie_id: 'sel-1', p_actor_id: 'actor-1', p_operation_key: 'start-1', p_uitgevoerd_op: tijd,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'off_market_brief_reserveren', {
      p_selectie_id: 'sel-1', p_actor_id: 'actor-1', p_operation_key: 'brief-1', p_uitgevoerd_op: tijd,
    });
  });

  it('mapt versie, batch en koppeling zonder losse tabelwrites', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ brief_versie_id: 'versie-1', versienummer: 1 }], error: null })
      .mockResolvedValueOnce({ data: [{ batch_id: 'batch-1', batchnummer: 'BAT2026080801' }], error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const repo = maakVroegeProductieSupabaseRepository({ activatie: actief, uitvoerder: { rpc }, klok: () => tijd });

    const inhoud = { brieftekst: 'Tekst' };
    const geadresseerde = { naam: 'Eigenaar', straatHuisnummer: 'Straat 1', postcode: '1234AB', plaats: 'Plaats', land: 'Nederland', verificatiestatus: 'handmatig_gecontroleerd' };
    await expect(repo.maakBriefversie({ briefId: 'brief-1', actorId: 'actor-1', operationKey: 'versie-1', inhoudSnapshot: inhoud, geadresseerdeSnapshot: geadresseerde }))
      .resolves.toMatchObject({ id: 'versie-1', briefId: 'brief-1', versienummer: 1, status: 'actief' });
    await expect(repo.maakPrintbatch({ actorId: 'actor-1', operationKey: 'batch-1', datum: '2026-08-08' }))
      .resolves.toMatchObject({ id: 'batch-1', batchnummer: 'BAT2026080801', status: 'concept', documentversie: 1 });
    await expect(repo.voegBriefversieToeAanBatch({ batchId: 'batch-1', briefId: 'brief-1', briefVersieId: 'versie-1', actorId: 'actor-1', operationKey: 'koppel-1' }))
      .resolves.toBeUndefined();

    expect(rpc).toHaveBeenNthCalledWith(1, 'off_market_briefversie_aanmaken', expect.objectContaining({ p_brief_id: 'brief-1', p_inhoud_snapshot: inhoud, p_geadresseerde_snapshot: geadresseerde }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'off_market_printbatch_aanmaken', expect.objectContaining({ p_datum: '2026-08-08' }));
    expect(rpc).toHaveBeenNthCalledWith(3, 'off_market_briefversie_aan_batch_toevoegen', expect.objectContaining({ p_batch_id: 'batch-1', p_brief_versie_id: 'versie-1' }));
  });

  it('weigert signaaldrift bij briefreservering', async () => {
    const repo = maakVroegeProductieSupabaseRepository({
      activatie: actief,
      uitvoerder: { rpc: vi.fn(async () => ({ data: [{ brief_id: 'brief-1', signaal_id: 'ander-signaal' }], error: null })) },
      klok: () => tijd,
    });
    await expect(repo.reserveerBrief({ selectieId: 'sel-1', signaalId: 'sig-1', actorId: 'actor-1', operationKey: 'brief-1', jaar: 2026 }))
      .rejects.toThrow('ander signaal');
  });
});
