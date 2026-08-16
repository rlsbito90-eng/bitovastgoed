import { describe, expect, it, vi } from 'vitest';

import { maakAtomischePrintbatchSupabaseRepository } from './atomischePrintbatchSupabaseRepository';
import type { ProductiekernActivatieBesluit } from './productiekernActivatieBesluit';

const actief: ProductiekernActivatieBesluit = {
  lezenActief: true,
  schrijvenActief: true,
  ontbrekendBewijs: [],
};
const dicht: ProductiekernActivatieBesluit = {
  lezenActief: false,
  schrijvenActief: false,
  ontbrekendBewijs: ['test-dicht'],
};

describe('atomische printbatch Supabase repository', () => {
  it('roept exact één atomische RPC aan met de volledige briefset', async () => {
    const rpc = vi.fn(async () => ({
      data: [{ batch_id: 'batch-1', batchnummer: 'BAT2026081601' }],
      error: null,
    }));
    const repo = maakAtomischePrintbatchSupabaseRepository({
      activatie: actief,
      uitvoerder: { rpc },
      klok: () => '2026-08-16T20:45:00.000Z',
    });

    const resultaat = await repo.maakPrintbatchMetBrieven({
      actorId: 'actor-1',
      operationKey: 'printbatch:scope-1',
      datum: '2026-08-16',
      brieven: [
        { briefId: 'brief-1', briefVersieId: 'versie-1' },
        { briefId: 'brief-2', briefVersieId: 'versie-2' },
      ],
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('off_market_printbatch_met_brieven_aanmaken', {
      p_actor_id: 'actor-1',
      p_operation_key: 'printbatch:scope-1',
      p_uitgevoerd_op: '2026-08-16T20:45:00.000Z',
      p_datum: '2026-08-16',
      p_brieven: [
        { brief_id: 'brief-1', brief_versie_id: 'versie-1' },
        { brief_id: 'brief-2', brief_versie_id: 'versie-2' },
      ],
    });
    expect(resultaat).toMatchObject({
      id: 'batch-1', batchnummer: 'BAT2026081601', status: 'concept', documentversie: 1,
    });
  });

  it('faalt gesloten als schrijven niet actief is', async () => {
    const rpc = vi.fn();
    const repo = maakAtomischePrintbatchSupabaseRepository({ activatie: dicht, uitvoerder: { rpc } });
    await expect(repo.maakPrintbatchMetBrieven({
      actorId: 'actor', operationKey: 'op', datum: '2026-08-16',
      brieven: [{ briefId: 'b', briefVersieId: 'v' }],
    })).rejects.toThrow('maakPrintbatchMetBrieven');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('weigert dubbele brief- en versie-ID’s vóór de RPC', async () => {
    const rpc = vi.fn();
    const repo = maakAtomischePrintbatchSupabaseRepository({ activatie: actief, uitvoerder: { rpc } });
    await expect(repo.maakPrintbatchMetBrieven({
      actorId: 'actor', operationKey: 'op', datum: '2026-08-16',
      brieven: [
        { briefId: 'b', briefVersieId: 'v1' },
        { briefId: 'b', briefVersieId: 'v2' },
      ],
    })).rejects.toThrow('Brief dubbel');
    await expect(repo.maakPrintbatchMetBrieven({
      actorId: 'actor', operationKey: 'op2', datum: '2026-08-16',
      brieven: [
        { briefId: 'b1', briefVersieId: 'v' },
        { briefId: 'b2', briefVersieId: 'v' },
      ],
    })).rejects.toThrow('Briefversie dubbel');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('weigert een malformed BAT-response', async () => {
    const repo = maakAtomischePrintbatchSupabaseRepository({
      activatie: actief,
      uitvoerder: {
        rpc: vi.fn(async () => ({ data: [{ batch_id: 'batch-1', batchnummer: 'fout' }], error: null })),
      },
    });
    await expect(repo.maakPrintbatchMetBrieven({
      actorId: 'actor', operationKey: 'op', datum: '2026-08-16',
      brieven: [{ briefId: 'b', briefVersieId: 'v' }],
    })).rejects.toThrow('ongeldig BAT-nummer');
  });
});
