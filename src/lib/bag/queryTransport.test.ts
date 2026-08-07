import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession } },
}));

import { haalPandenInViewport, zoekPandenViaService } from './queryTransport';

describe('BAG 2A.9 querytransport', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv(
      'VITE_BAG_QUERY_FUNCTION_URL',
      'https://xfygspvpeugxowxbcvnm.supabase.co/functions/v1/bag-query-service',
    );
    getSession.mockReset();
    getSession.mockResolvedValue({
      data: { session: { access_token: 'production-user-jwt' } },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('stuurt uitsluitend een gevalideerde viewport naar de Edge-grens', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      rows: [{ identificatie: 'P1' }],
    }), { status: 200 }));
    await expect(haalPandenInViewport({
      scopeCode: '0363',
      viewport: { minX: 100_000, minY: 450_000, maxX: 101_000, maxY: 451_000 },
      limiet: 250,
    })).resolves.toEqual({ rows: [{ identificatie: 'P1' }] });
    expect(fetch).toHaveBeenCalledWith(
      'https://xfygspvpeugxowxbcvnm.supabase.co/functions/v1/bag-query-service',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer production-user-jwt',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'viewport', scopeCode: '0363', minX: 100_000, minY: 450_000,
          maxX: 101_000, maxY: 451_000, limit: 250,
        }),
      },
    );
  });

  it('weigert lokaal ongeldige grenzen zonder netwerkverzoek', async () => {
    await expect(haalPandenInViewport({
      scopeCode: '0363',
      viewport: { minX: 101_000, minY: 450_000, maxX: 100_000, maxY: 451_000 },
      limiet: 250,
    })).rejects.toThrow('RD New-zone');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ondersteunt alleen begrensde keysetzoekvragen en maskeert transportfouten', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    await zoekPandenViaService({ scopeCode: '0363', naIdentificatie: 'P100', limiet: 100 });
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: JSON.stringify({ action: 'search', scopeCode: '0363', cursor: 'P100', limit: 100 }),
    }));

    vi.mocked(fetch).mockRejectedValueOnce(new Error('sensitive detail'));
    await expect(zoekPandenViaService({
      scopeCode: '0363', naIdentificatie: null, limiet: 100,
    })).rejects.toThrow('De BAG-queryservice is niet beschikbaar.');
  });

  it('weigert een ontbrekende of verkeerde project-URL voor ieder netwerkverzoek', async () => {
    vi.stubEnv(
      'VITE_BAG_QUERY_FUNCTION_URL',
      'https://ljudxyrqoifhfikueric.supabase.co/functions/v1/bag-query-service',
    );
    await expect(zoekPandenViaService({
      scopeCode: '0363', naIdentificatie: null, limiet: 100,
    })).rejects.toThrow('niet veilig geconfigureerd');
    expect(getSession).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stuurt nooit een verzoek zonder een geldige CRM-sessie', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(zoekPandenViaService({
      scopeCode: '0363', naIdentificatie: null, limiet: 100,
    })).rejects.toThrow('Log opnieuw in');
    expect(fetch).not.toHaveBeenCalled();
  });
});
