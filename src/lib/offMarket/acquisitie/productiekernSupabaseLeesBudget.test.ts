import { describe, expect, it, vi } from 'vitest';

import {
  metProductiekernLeesBudget,
  ProductiekernLeesBudgetOverschredenError,
} from './productiekernSupabaseLeesBudget';

const query = {
  tabel: 'off_market_brieven',
  selectKolommen: ['id'],
  filterKolom: 'id',
  filterWaarde: 'brief-1',
  cardinaliteit: 'nul_of_een' as const,
  maximaalAantalRecords: 1,
};

describe('metProductiekernLeesBudget', () => {
  it('delegeert uitsluitend binnen het ingestelde querybudget', async () => {
    const voerUit = vi.fn(async () => ({ id: 'brief-1' }));
    const uitvoerder = metProductiekernLeesBudget({ voerUit }, 2);

    await expect(uitvoerder.voerUit(query)).resolves.toEqual({ id: 'brief-1' });
    await expect(uitvoerder.voerUit(query)).resolves.toEqual({ id: 'brief-1' });
    await expect(uitvoerder.voerUit(query))
      .rejects.toBeInstanceOf(ProductiekernLeesBudgetOverschredenError);
    expect(voerUit).toHaveBeenCalledTimes(2);
  });

  it('telt ook mislukte onderliggende querypogingen mee', async () => {
    const voerUit = vi.fn(async () => { throw new Error('mislukt'); });
    const uitvoerder = metProductiekernLeesBudget({ voerUit }, 1);

    await expect(uitvoerder.voerUit(query)).rejects.toThrow('mislukt');
    await expect(uitvoerder.voerUit(query))
      .rejects.toBeInstanceOf(ProductiekernLeesBudgetOverschredenError);
    expect(voerUit).toHaveBeenCalledTimes(1);
  });

  it('weigert een onbegrensd of ongeldig budget', () => {
    const basis = { voerUit: vi.fn() };
    for (const budget of [0, 101, 1.5]) {
      expect(() => metProductiekernLeesBudget(basis, budget))
        .toThrow('Productiekern-leesbudget moet tussen 1 en 100 queries liggen.');
    }
  });
});
