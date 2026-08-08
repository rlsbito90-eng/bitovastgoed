import { describe, expect, it, vi } from 'vitest';

import { metProductiekernLeesBudget, ProductiekernLeesBudgetOverschredenError } from './productiekernSupabaseLeesBudget';
import { metBegrensdeProductiekernLeesRetry } from './productiekernSupabaseLeesRetry';
import { metSamengevoegdeProductiekernReads } from './productiekernSupabaseLeesSamenvoeging';
import { metProductiekernLeesTimeout, ProductiekernLeesTimeoutError } from './productiekernSupabaseLeesTimeout';
import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

const bulkInput = {
  tabel: 'off_market_brieven',
  selectKolommen: ['id'],
  filterKolom: 'id',
  filterWaarden: ['brief-1', 'brief-2'],
  maximaalAantalRecords: 1000,
};

const singleInput = {
  tabel: 'off_market_brieven', selectKolommen: ['id'], filterKolom: 'id', filterWaarde: 'brief-1',
  cardinaliteit: 'nul_of_een' as const, maximaalAantalRecords: 1,
};

describe('productiekern bulkread weerbaarheid', () => {
  it('deelt één budget tussen single- en bulkqueries', async () => {
    const basis: ProductiekernSupabaseQueryUitvoerder = {
      voerUit: vi.fn(async () => ({ id: 'brief-1' })),
      voerBulkUit: vi.fn(async () => [{ id: 'brief-1' }, { id: 'brief-2' }]),
    };
    const uitvoerder = metProductiekernLeesBudget(basis, 1);
    await expect(uitvoerder.voerUit(singleInput)).resolves.toEqual({ id: 'brief-1' });
    await expect(uitvoerder.voerBulkUit?.(bulkInput))
      .rejects.toBeInstanceOf(ProductiekernLeesBudgetOverschredenError);
    expect(basis.voerBulkUit).not.toHaveBeenCalled();
  });

  it('retryt tijdelijke bulktransportfouten met dezelfde begrenzing', async () => {
    const voerBulkUit = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce([{ id: 'brief-1' }]);
    const uitvoerder = metBegrensdeProductiekernLeesRetry({
      voerUit: vi.fn(async () => null),
      voerBulkUit,
    }, { maximaalAantalPogingen: 2, wacht: async () => undefined });

    await expect(uitvoerder.voerBulkUit?.(bulkInput)).resolves.toEqual([{ id: 'brief-1' }]);
    expect(voerBulkUit).toHaveBeenCalledTimes(2);
  });

  it('begrenst ook een hangende bulkread met timeout', async () => {
    const uitvoerder = metProductiekernLeesTimeout({
      voerUit: vi.fn(async () => null),
      voerBulkUit: vi.fn(() => new Promise<Record<string, unknown>[]>(() => undefined)),
    }, {
      timeoutMs: 100,
      planTimeout: (callback) => {
        queueMicrotask(callback);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      annuleerTimeout: vi.fn(),
    });

    await expect(uitvoerder.voerBulkUit?.(bulkInput))
      .rejects.toBeInstanceOf(ProductiekernLeesTimeoutError);
  });

  it('voegt identieke gelijktijdige bulkreads samen en bewaart verschillende ID-volgordes apart', async () => {
    const resolvers: Array<(waarde: Record<string, unknown>[]) => void> = [];
    const voerBulkUit = vi.fn(() => new Promise<Record<string, unknown>[]>((resolve) => { resolvers.push(resolve); }));
    const uitvoerder = metSamengevoegdeProductiekernReads({
      voerUit: vi.fn(async () => null),
      voerBulkUit,
    });

    const eerste = uitvoerder.voerBulkUit!(bulkInput);
    const tweede = uitvoerder.voerBulkUit!(bulkInput);
    expect(voerBulkUit).toHaveBeenCalledTimes(1);
    resolvers[0]?.([{ id: 'brief-1' }, { id: 'brief-2' }]);
    await expect(Promise.all([eerste, tweede])).resolves.toHaveLength(2);

    const derde = uitvoerder.voerBulkUit!({ ...bulkInput, filterWaarden: ['brief-2', 'brief-1'] });
    expect(voerBulkUit).toHaveBeenCalledTimes(2);
    resolvers[1]?.([{ id: 'brief-2' }, { id: 'brief-1' }]);
    await expect(derde).resolves.toHaveLength(2);
  });
});
