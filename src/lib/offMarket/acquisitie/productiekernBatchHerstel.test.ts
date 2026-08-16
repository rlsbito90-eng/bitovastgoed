import { describe, expect, it, vi } from 'vitest';

import {
  SupabaseProductiekernLeesRepository,
  type ProductiekernSupabaseLeesTransport,
} from './productiekernSupabaseLeesRepository';

function koppeling(versieId: string, batchId: string, verwijderdOp: string | null = null) {
  return {
    id: `k-${versieId}-${batchId}`,
    batch_id: batchId,
    brief_id: `brief-${versieId}`,
    brief_versie_id: versieId,
    verwijderd_op: verwijderdOp,
    afwijkingsstatus: null,
    afwijkingsreden: null,
    created_at: '2026-08-16T21:00:00Z',
  };
}

function repositoryVoor(perVersie: Record<string, Record<string, unknown>[]>): SupabaseProductiekernLeesRepository {
  const transport: ProductiekernSupabaseLeesTransport = {
    haalEen: vi.fn(async () => null),
    haalMeerdere: vi.fn(async () => []),
    haalMeerdereOpIds: vi.fn(async (tabel, ids) => {
      if (tabel !== 'off_market_printbatch_brieven') return [];
      return ids.flatMap((id) => perVersie[id] ?? []);
    }),
  };
  return new SupabaseProductiekernLeesRepository(transport);
}

describe('canoniek BAT-herstel', () => {
  it('geeft null wanneer nog geen briefversie aan een BAT gekoppeld is', async () => {
    const repository = repositoryVoor({});
    await expect(repository.haalActievePrintbatchIdVoorBriefversies(['v1', 'v2'])).resolves.toBeNull();
  });

  it('herstelt exact één gedeelde actieve BAT voor de volledige briefscope', async () => {
    const repository = repositoryVoor({
      v1: [koppeling('v1', 'batch-1')],
      v2: [koppeling('v2', 'batch-1'), koppeling('v2', 'oude-batch', '2026-08-16T20:00:00Z')],
    });
    await expect(repository.haalActievePrintbatchIdVoorBriefversies(['v2', 'v1', 'v1'])).resolves.toBe('batch-1');
  });

  it('blokkeert een gedeeltelijke of over meerdere BATs verdeelde scope', async () => {
    const gedeeltelijk = repositoryVoor({ v1: [koppeling('v1', 'batch-1')] });
    await expect(gedeeltelijk.haalActievePrintbatchIdVoorBriefversies(['v1', 'v2']))
      .rejects.toThrow('gedeeltelijk');

    const verdeeld = repositoryVoor({
      v1: [koppeling('v1', 'batch-1')],
      v2: [koppeling('v2', 'batch-2')],
    });
    await expect(verdeeld.haalActievePrintbatchIdVoorBriefversies(['v1', 'v2']))
      .rejects.toThrow('meerdere actieve printbatches');
  });

  it('blokkeert meerdere actieve koppelingen voor dezelfde immutable versie', async () => {
    const repository = repositoryVoor({
      v1: [koppeling('v1', 'batch-1'), koppeling('v1', 'batch-2')],
    });
    await expect(repository.haalActievePrintbatchIdVoorBriefversies(['v1']))
      .rejects.toThrow('meerdere actieve printbatches');
  });
});
