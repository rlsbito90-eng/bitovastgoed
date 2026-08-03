import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

import { haalPandenInViewport, zoekPandenViaService } from './queryTransport';

describe('BAG 2A.9 querytransport', () => {
  beforeEach(() => invoke.mockReset());

  it('stuurt uitsluitend een gevalideerde viewport naar de Edge-grens', async () => {
    invoke.mockResolvedValue({ data: { rows: [{ identificatie: 'P1' }] }, error: null });
    await expect(haalPandenInViewport({
      scopeCode: 'NL',
      viewport: { minX: 100_000, minY: 450_000, maxX: 101_000, maxY: 451_000 },
      limiet: 250,
    })).resolves.toEqual({ rows: [{ identificatie: 'P1' }] });
    expect(invoke).toHaveBeenCalledWith('bag-query-service', { body: {
      action: 'viewport', scopeCode: 'NL', minX: 100_000, minY: 450_000,
      maxX: 101_000, maxY: 451_000, limit: 250,
    } });
  });

  it('weigert lokaal ongeldige grenzen zonder netwerkverzoek', async () => {
    await expect(haalPandenInViewport({
      scopeCode: 'NL',
      viewport: { minX: 101_000, minY: 450_000, maxX: 100_000, maxY: 451_000 },
      limiet: 250,
    })).rejects.toThrow('RD New-zone');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('ondersteunt alleen begrensde keysetzoekvragen en maskeert transportfouten', async () => {
    invoke.mockResolvedValueOnce({ data: { rows: [] }, error: null });
    await zoekPandenViaService({ scopeCode: 'NL', naIdentificatie: 'P100', limiet: 100 });
    expect(invoke).toHaveBeenCalledWith('bag-query-service', { body: {
      action: 'search', scopeCode: 'NL', cursor: 'P100', limit: 100,
    } });

    invoke.mockResolvedValueOnce({ data: null, error: new Error('sensitive detail') });
    await expect(zoekPandenViaService({
      scopeCode: 'NL', naIdentificatie: null, limiet: 100,
    })).rejects.toThrow('De BAG-queryservice is niet beschikbaar.');
  });
});
