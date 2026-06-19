// V2.3 — useBagVerrijken roept edge function aan en persisteert advies.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBagVerrijken } from '@/hooks/useBagVerrijken';

const invokeMock = vi.fn();
const updateMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => maybeSingleMock() }),
      }),
      update: (patch: unknown) => ({
        eq: async () => updateMock(patch),
      }),
    }),
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useBagVerrijken', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    updateMock.mockReset();
    maybeSingleMock.mockReset();
  });

  it('roept off-market-bag-verrijk aan met signaal_id + force', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, status: 'verrijkt' }, error: null });
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 's1', ai_status: 'klaar', ai_score: 80,
        bag_status: 'verrijkt', bag_aantal_vbo: 2, bag_totaal_oppervlakte_m2: 200,
        bag_match_kwaliteit: 'exact',
      },
      error: null,
    });
    updateMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useBagVerrijken(), { wrapper: wrap() });
    await result.current.mutateAsync({ signaalId: 's1', force: true });

    expect(invokeMock).toHaveBeenCalledWith('off-market-bag-verrijk', {
      body: { signaal_id: 's1', force: true },
    });
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const patch = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(patch).toHaveProperty('kadasteradvies');
    expect(patch).toHaveProperty('kadasteradvies_reden');
  });

  it('roept geen Kadaster-edge-function aan', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, status: 'verrijkt' }, error: null });
    maybeSingleMock.mockResolvedValue({ data: { id: 's1', bag_status: 'verrijkt', ai_status: 'klaar', ai_score: 50 }, error: null });
    updateMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useBagVerrijken(), { wrapper: wrap() });
    await result.current.mutateAsync({ signaalId: 's1' });

    const called = invokeMock.mock.calls.map((c) => c[0]);
    expect(called).not.toContain('kadaster-objectinformatie');
  });
});
