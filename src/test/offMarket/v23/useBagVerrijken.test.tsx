// V2.3 + V2.7 — useBagVerrijken roept BAG-edge-function aan.
// V2.7: Kadasteradvies wordt voortaan server-side door off-market-bag-verrijk
// gepersisteerd; de hook schrijft géén advies meer client-side.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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

  it('roept off-market-bag-verrijk aan met signaal_id + force, zonder client-side advieswrite', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true, status: 'verrijkt' }, error: null });
    updateMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useBagVerrijken(), { wrapper: wrap() });
    await result.current.mutateAsync({ signaalId: 's1', force: true });

    expect(invokeMock).toHaveBeenCalledWith('off-market-bag-verrijk', {
      body: { signaal_id: 's1', force: true },
    });
    // V2.7: server persisteert het advies. Geen client-side update meer.
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('roept geen Kadaster-edge-function aan', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, status: 'verrijkt' }, error: null });
    const { result } = renderHook(() => useBagVerrijken(), { wrapper: wrap() });
    await result.current.mutateAsync({ signaalId: 's1' });

    const called = invokeMock.mock.calls.map((c) => c[0]);
    expect(called).not.toContain('kadaster-objectinformatie');
    expect(called).not.toContain('off-market-kadaster-check');
  });
});
