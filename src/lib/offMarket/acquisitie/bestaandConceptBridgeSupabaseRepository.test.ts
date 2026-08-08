import { describe, expect, it, vi } from 'vitest';

import { productiekernStandaardUitgeschakeld } from './productieActivatiePoort';
import { ProductieTransactiesNietGeactiveerdError } from './productieTransactieRepository';
import { maakBestaandConceptBridgeSupabaseRepository } from './bestaandConceptBridgeSupabaseRepository';

const actief = { lezenActief: true, schrijvenActief: true, ontbrekendBewijs: [] };
const tijd = '2026-08-08T21:10:00.000Z';

const command = {
  selectieId: 'sel-1',
  signaalId: 'sig-1',
  briefId: 'brief-1',
  actorId: 'actor-1',
  operationKey: 'bridge-1',
  inhoudSnapshot: { brieftekst: 'Bestaande concepttekst', onderwerp: 'Onderwerp' },
  geadresseerdeSnapshot: { naam: 'Eigenaar', verzendadres: 'Straat 1\n1234 AB Plaats\nNederland' },
};

describe('maakBestaandConceptBridgeSupabaseRepository', () => {
  it('blokkeert vóór RPC wanneer de centrale schrijfpoort dicht is', async () => {
    const rpc = vi.fn();
    const repo = maakBestaandConceptBridgeSupabaseRepository({
      activatie: productiekernStandaardUitgeschakeld,
      uitvoerder: { rpc },
      klok: () => tijd,
    });

    await expect(repo.koppelBestaandConcept(command))
      .rejects.toBeInstanceOf(ProductieTransactiesNietGeactiveerdError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('mapt exact naar de transactionele bridge-RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        brief_id: 'brief-1',
        signaal_id: 'sig-1',
        brief_versie_id: 'versie-1',
        versienummer: 1,
      }],
      error: null,
    }));
    const repo = maakBestaandConceptBridgeSupabaseRepository({
      activatie: actief,
      uitvoerder: { rpc },
      klok: () => tijd,
    });

    await expect(repo.koppelBestaandConcept(command)).resolves.toEqual({
      briefId: 'brief-1',
      signaalId: 'sig-1',
      briefVersieId: 'versie-1',
      versienummer: 1,
    });

    expect(rpc).toHaveBeenCalledWith('off_market_bestaand_concept_koppelen', {
      p_selectie_id: 'sel-1',
      p_brief_id: 'brief-1',
      p_actor_id: 'actor-1',
      p_operation_key: 'bridge-1',
      p_uitgevoerd_op: tijd,
      p_inhoud_snapshot: command.inhoudSnapshot,
      p_geadresseerde_snapshot: command.geadresseerdeSnapshot,
    });
  });

  it('weigert brief- en signaaldrift uit de RPC-response', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{ brief_id: 'andere-brief', signaal_id: 'sig-1', brief_versie_id: 'versie-1', versienummer: 1 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ brief_id: 'brief-1', signaal_id: 'ander-signaal', brief_versie_id: 'versie-1', versienummer: 1 }],
        error: null,
      });
    const repo = maakBestaandConceptBridgeSupabaseRepository({
      activatie: actief,
      uitvoerder: { rpc },
      klok: () => tijd,
    });

    await expect(repo.koppelBestaandConcept(command)).rejects.toThrow('andere brief');
    await expect(repo.koppelBestaandConcept(command)).rejects.toThrow('ander signaal');
  });
});
