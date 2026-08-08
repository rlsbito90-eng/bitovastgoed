import { describe, expect, it, vi } from 'vitest';

import {
  maakProductiekernSupabaseQueryUitvoerder,
  type ProductiekernSupabaseClientLike,
  type ProductiekernSupabaseQueryBuilder,
} from './productiekernSupabaseQueryUitvoerder';

function builder(resultaat: { data: unknown; error: unknown }) {
  const b: ProductiekernSupabaseQueryBuilder & {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn(),
    maybeSingle: vi.fn(async () => resultaat),
    then(onfulfilled, onrejected) {
      return Promise.resolve(resultaat).then(onfulfilled, onrejected);
    },
  } as never;
  b.select.mockReturnValue(b);
  b.eq.mockReturnValue(b);
  b.in.mockReturnValue(b);
  b.order.mockReturnValue(b);
  b.limit.mockReturnValue(b);
  return b;
}

describe('maakProductiekernSupabaseQueryUitvoerder', () => {
  it('vertaalt een nul-of-een read naar select + eq + limit + maybeSingle', async () => {
    const b = builder({ data: { id: 'brief-1' }, error: null });
    const client: ProductiekernSupabaseClientLike = { from: vi.fn(() => b) };
    const uitvoerder = maakProductiekernSupabaseQueryUitvoerder(client);

    await expect(uitvoerder.voerUit({
      tabel: 'off_market_brieven', selectKolommen: ['id', 'status'], filterKolom: 'id',
      filterWaarde: 'brief-1', cardinaliteit: 'nul_of_een', maximaalAantalRecords: 1,
    })).resolves.toEqual({ id: 'brief-1' });

    expect(client.from).toHaveBeenCalledWith('off_market_brieven');
    expect(b.select).toHaveBeenCalledWith('id,status');
    expect(b.eq).toHaveBeenCalledWith('id', 'brief-1');
    expect(b.limit).toHaveBeenCalledWith(1);
    expect(b.maybeSingle).toHaveBeenCalledTimes(1);
    expect(b.in).not.toHaveBeenCalled();
  });

  it('vertaalt lijstvolgorde naar order en gebruikt geen maybeSingle', async () => {
    const b = builder({ data: [{ id: 'versie-1' }], error: null });
    const uitvoerder = maakProductiekernSupabaseQueryUitvoerder({ from: vi.fn(() => b) });

    await expect(uitvoerder.voerUit({
      tabel: 'off_market_brief_versies', selectKolommen: ['id'], filterKolom: 'brief_id',
      filterWaarde: 'brief-1', cardinaliteit: 'lijst', maximaalAantalRecords: 100,
      volgorde: { kolom: 'versienummer', oplopend: true },
    })).resolves.toEqual([{ id: 'versie-1' }]);
    expect(b.order).toHaveBeenCalledWith('versienummer', { ascending: true });
    expect(b.maybeSingle).not.toHaveBeenCalled();
  });

  it('vertaalt bulk uitsluitend naar select + in + limit', async () => {
    const b = builder({ data: [{ id: 'brief-1' }, { id: 'brief-2' }], error: null });
    const uitvoerder = maakProductiekernSupabaseQueryUitvoerder({ from: vi.fn(() => b) });

    await expect(uitvoerder.voerBulkUit?.({
      tabel: 'off_market_brieven', selectKolommen: ['id'], filterKolom: 'id',
      filterWaarden: ['brief-1', 'brief-2'], maximaalAantalRecords: 1000,
    })).resolves.toHaveLength(2);
    expect(b.in).toHaveBeenCalledWith('id', ['brief-1', 'brief-2']);
    expect(b.eq).not.toHaveBeenCalled();
    expect(b.limit).toHaveBeenCalledWith(1000);
  });

  it('geeft Supabase-fouten door aan de bestaande normalisatielaag en logt niets', async () => {
    const fout = { code: '42501', message: 'permission denied for table geheim' };
    const b = builder({ data: null, error: fout });
    const uitvoerder = maakProductiekernSupabaseQueryUitvoerder({ from: vi.fn(() => b) });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(uitvoerder.voerUit({
      tabel: 'off_market_brieven', selectKolommen: ['id'], filterKolom: 'id',
      filterWaarde: 'brief-1', cardinaliteit: 'nul_of_een', maximaalAantalRecords: 1,
    })).rejects.toBe(fout);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
