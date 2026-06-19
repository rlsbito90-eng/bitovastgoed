// V2.4 — useBagVerrijken stuurt selected_vbo_id correct mee.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBagVerrijken } from '@/hooks/useBagVerrijken';

const invokeMock = vi.fn();
const maybeSingleMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingleMock() }) }),
      update: () => ({ eq: async () => updateMock() }),
    }),
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useBagVerrijken — selectie payload', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: { id: 's1', bag_status: 'verrijkt' }, error: null });
    updateMock.mockResolvedValue({ data: null, error: null });
  });

  it('stuurt selected_vbo_id + selected_nummeraanduiding_id mee', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, status: 'verrijkt' }, error: null });
    const { result } = renderHook(() => useBagVerrijken(), { wrapper: wrap() });
    await result.current.mutateAsync({
      signaalId: 's1',
      force: true,
      selected_vbo_id: 'vbo-x',
      selected_nummeraanduiding_id: 'na-x',
    });
    expect(invokeMock).toHaveBeenCalledWith('off-market-bag-verrijk', {
      body: {
        signaal_id: 's1', force: true,
        selected_vbo_id: 'vbo-x',
        selected_nummeraanduiding_id: 'na-x',
      },
    });
  });

  it('werkt zonder selectie (backwards compatible)', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, status: 'meerdere_matches' }, error: null });
    const { result } = renderHook(() => useBagVerrijken(), { wrapper: wrap() });
    await result.current.mutateAsync({ signaalId: 's1' });
    expect(invokeMock).toHaveBeenCalledWith('off-market-bag-verrijk', {
      body: { signaal_id: 's1', force: false },
    });
  });
});
