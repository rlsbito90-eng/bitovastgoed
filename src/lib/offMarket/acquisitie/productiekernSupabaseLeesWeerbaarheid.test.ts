import { describe, expect, it, vi } from 'vitest';

import { maakWeerbareProductiekernLeesUitvoerder } from './productiekernSupabaseLeesWeerbaarheid';

const query = {
  tabel: 'off_market_brieven',
  selectKolommen: ['id'],
  filterKolom: 'id',
  filterWaarde: 'brief-1',
  cardinaliteit: 'nul_of_een' as const,
};

describe('maakWeerbareProductiekernLeesUitvoerder', () => {
  it('probeert een getimede-out poging begrensd opnieuw', async () => {
    let timeoutCallback: (() => void) | undefined;
    const voerUit = vi.fn()
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce({ id: 'brief-1' });
    const wacht = vi.fn(async () => undefined);
    const uitvoerder = maakWeerbareProductiekernLeesUitvoerder(
      { voerUit },
      {
        timeout: {
          timeoutMs: 100,
          planTimeout: vi.fn((callback) => {
            timeoutCallback = callback;
            return 1 as unknown as ReturnType<typeof setTimeout>;
          }),
          annuleerTimeout: vi.fn(),
        },
        retry: { maximaalAantalPogingen: 2, wacht, wachttijdenMs: [0] },
      },
    );

    const resultaat = uitvoerder.voerUit(query);
    timeoutCallback?.();
    await expect(resultaat).resolves.toEqual({ id: 'brief-1' });
    expect(voerUit).toHaveBeenCalledTimes(2);
    expect(wacht).toHaveBeenCalledTimes(1);
  });

  it('herhaalt structurele autorisatiefouten niet', async () => {
    const voerUit = vi.fn(async () => { throw { code: '42501' }; });
    const uitvoerder = maakWeerbareProductiekernLeesUitvoerder(
      { voerUit },
      {
        timeout: { timeoutMs: 100 },
        retry: { maximaalAantalPogingen: 3, wacht: vi.fn(async () => undefined) },
      },
    );

    await expect(uitvoerder.voerUit(query)).rejects.toEqual({ code: '42501' });
    expect(voerUit).toHaveBeenCalledTimes(1);
  });
});
