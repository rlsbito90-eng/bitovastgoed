import { describe, expect, it, vi } from 'vitest';

import { metBegrensdeProductiekernLeesRetry } from './productiekernSupabaseLeesRetry';

const query = {
  tabel: 'off_market_brieven',
  selectKolommen: ['id'],
  filterKolom: 'id',
  filterWaarde: 'brief-1',
  cardinaliteit: 'nul_of_een' as const,
  maximaalAantalRecords: 1,
};

describe('metBegrensdeProductiekernLeesRetry', () => {
  it('herstelt na een tijdelijke fout en gebruikt begrensde wachttijden', async () => {
    const voerUit = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ id: 'brief-1' });
    const wacht = vi.fn(async () => undefined);
    const uitvoerder = metBegrensdeProductiekernLeesRetry(
      { voerUit },
      { wacht, wachttijdenMs: [25], maximaalAantalPogingen: 2 },
    );

    await expect(uitvoerder.voerUit(query)).resolves.toEqual({ id: 'brief-1' });
    expect(voerUit).toHaveBeenCalledTimes(2);
    expect(wacht).toHaveBeenCalledWith(25);
  });

  it('herhaalt autorisatie-, schema- en onbekende fouten nooit', async () => {
    for (const fout of [{ code: '42501' }, { code: '42P01' }, new Error('onbekend')]) {
      const voerUit = vi.fn(async () => { throw fout; });
      const uitvoerder = metBegrensdeProductiekernLeesRetry({ voerUit });

      await expect(uitvoerder.voerUit(query)).rejects.toBe(fout);
      expect(voerUit).toHaveBeenCalledTimes(1);
    }
  });

  it('stopt na maximaal drie pogingen en behoudt de oorspronkelijke fout', async () => {
    const fout = { status: 503, message: 'niet doorgeven' };
    const voerUit = vi.fn(async () => { throw fout; });
    const wacht = vi.fn(async () => undefined);
    const uitvoerder = metBegrensdeProductiekernLeesRetry(
      { voerUit },
      { wacht, maximaalAantalPogingen: 3 },
    );

    await expect(uitvoerder.voerUit(query)).rejects.toBe(fout);
    expect(voerUit).toHaveBeenCalledTimes(3);
    expect(wacht).toHaveBeenCalledTimes(2);
  });

  it('weigert onbegrensde of ongeldige retryconfiguratie', () => {
    const basis = { voerUit: vi.fn() };
    expect(() => metBegrensdeProductiekernLeesRetry(basis, { maximaalAantalPogingen: 4 }))
      .toThrow('Maximaal aantal leespogingen moet tussen 1 en 3 liggen.');
    expect(() => metBegrensdeProductiekernLeesRetry(basis, { wachttijdenMs: [-1] }))
      .toThrow('Retrywachttijden moeten niet-negatieve eindige getallen zijn.');
  });
});
