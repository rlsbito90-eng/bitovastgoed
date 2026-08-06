import { describe, expect, it, vi } from 'vitest';

import {
  metProductiekernLeesTimeout,
  ProductiekernLeesTimeoutError,
} from './productiekernSupabaseLeesTimeout';

const query = {
  tabel: 'off_market_brieven',
  selectKolommen: ['id'],
  filterKolom: 'id',
  filterWaarde: 'brief-1',
  cardinaliteit: 'nul_of_een' as const,
};

describe('metProductiekernLeesTimeout', () => {
  it('geeft een snel resultaat door en ruimt de timer op', async () => {
    const annuleerTimeout = vi.fn();
    const timer = 123 as unknown as ReturnType<typeof setTimeout>;
    const uitvoerder = metProductiekernLeesTimeout(
      { voerUit: vi.fn(async () => ({ id: 'brief-1' })) },
      {
        timeoutMs: 100,
        planTimeout: vi.fn(() => timer),
        annuleerTimeout,
      },
    );

    await expect(uitvoerder.voerUit(query)).resolves.toEqual({ id: 'brief-1' });
    expect(annuleerTimeout).toHaveBeenCalledWith(timer);
  });

  it('breekt een trage poging af met een genormaliseerbare 408-fout', async () => {
    let callback: (() => void) | undefined;
    const uitvoerder = metProductiekernLeesTimeout(
      { voerUit: vi.fn(() => new Promise(() => undefined)) },
      {
        timeoutMs: 250,
        planTimeout: vi.fn((cb) => {
          callback = cb;
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }),
        annuleerTimeout: vi.fn(),
      },
    );

    const resultaat = uitvoerder.voerUit(query);
    callback?.();
    await expect(resultaat).rejects.toMatchObject({
      code: 'ACQUISITIE_PRODUCTIEKERN_LEES_TIMEOUT',
      status: 408,
      timeoutMs: 250,
    });
    await expect(resultaat).rejects.toBeInstanceOf(ProductiekernLeesTimeoutError);
  });

  it('weigert een te korte, te lange of niet-gehele timeout', () => {
    const basis = { voerUit: vi.fn() };
    for (const timeoutMs of [99, 30_001, 100.5]) {
      expect(() => metProductiekernLeesTimeout(basis, { timeoutMs }))
        .toThrow('Leestimeout moet een geheel aantal milliseconden tussen 100 en 30000 zijn.');
    }
  });
});
