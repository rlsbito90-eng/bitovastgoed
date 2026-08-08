import { describe, expect, it, vi } from 'vitest';

import { metSamengevoegdeProductiekernReads } from './productiekernSupabaseLeesSamenvoeging';

const query = {
  tabel: 'off_market_brieven',
  selectKolommen: ['id'],
  filterKolom: 'id',
  filterWaarde: 'brief-1',
  cardinaliteit: 'nul_of_een' as const,
  maximaalAantalRecords: 1,
};

describe('metSamengevoegdeProductiekernReads', () => {
  it('deelt één lopende Promise voor exact dezelfde query', async () => {
    let voltooi!: (waarde: Record<string, unknown>) => void;
    const voerUit = vi.fn(() => new Promise<Record<string, unknown>>((resolve) => {
      voltooi = resolve;
    }));
    const uitvoerder = metSamengevoegdeProductiekernReads({ voerUit });

    const eerste = uitvoerder.voerUit(query);
    const tweede = uitvoerder.voerUit({ ...query });
    expect(voerUit).toHaveBeenCalledTimes(1);
    expect(tweede).toBe(eerste);

    voltooi({ id: 'brief-1' });
    await expect(eerste).resolves.toEqual({ id: 'brief-1' });
  });

  it('voegt afwijkende filters of querycontracten niet samen', async () => {
    const voerUit = vi.fn(async (input) => ({ id: input.filterWaarde }));
    const uitvoerder = metSamengevoegdeProductiekernReads({ voerUit });

    await Promise.all([
      uitvoerder.voerUit(query),
      uitvoerder.voerUit({ ...query, filterWaarde: 'brief-2' }),
    ]);
    expect(voerUit).toHaveBeenCalledTimes(2);
  });

  it('verwijdert geslaagde en mislukte verzoeken na afronding', async () => {
    const fout = new Error('tijdelijk');
    const voerUit = vi.fn()
      .mockRejectedValueOnce(fout)
      .mockResolvedValueOnce({ id: 'brief-1' });
    const uitvoerder = metSamengevoegdeProductiekernReads({ voerUit });

    await expect(uitvoerder.voerUit(query)).rejects.toBe(fout);
    await expect(uitvoerder.voerUit(query)).resolves.toEqual({ id: 'brief-1' });
    expect(voerUit).toHaveBeenCalledTimes(2);
  });
});
