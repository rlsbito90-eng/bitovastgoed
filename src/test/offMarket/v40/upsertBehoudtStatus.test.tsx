// V40 — useUpsertBrief mag bij een bestaand record nooit status,
// verzendstatus of kanaal terugzetten. Inhoudelijke updates blijven
// werken; een verstuurd record blijft verstuurd na een content-edit.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMock = vi.fn();
const insertMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: (t: string) => fromMock(t),
  },
}));

beforeEach(() => {
  updateMock.mockReset();
  insertMock.mockReset();
  fromMock.mockReset();
});

import { useUpsertBrief } from '@/hooks/useOffMarketBrieven';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useUpsertBrief — bestaand record', () => {
  it('strippt status/verzendstatus/kanaal uit update-payload', async () => {
    const teruggegeven = {
      id: 'b1', signaal_id: 's1', status: 'verstuurd',
      verzendstatus: 'verzonden', kanaal: 'email', brieftekst: 'NIEUW',
    };
    fromMock.mockImplementation((t: string) => {
      if (t === 'off_market_brieven') {
        return {
          update: (patch: any) => {
            updateMock(patch);
            return {
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: teruggegeven, error: null }),
                }),
              }),
            };
          },
          insert: insertMock,
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const { result } = renderHook(() => useUpsertBrief(), { wrapper: wrap() });
    await result.current.mutateAsync({
      id: 'b1',
      signaal_id: 's1',
      brieftekst: 'NIEUW',
      status: 'concept',     // mag verstuurd record nooit downgraden
      kanaal: 'post',        // mag opgeslagen kanaal niet wijzigen
      verzendstatus: 'concept',
    } as any);

    expect(updateMock).toHaveBeenCalledTimes(1);
    const patch = updateMock.mock.calls[0][0];
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('verzendstatus');
    expect(patch).not.toHaveProperty('kanaal');
    expect(patch.brieftekst).toBe('NIEUW');
    expect(insertMock).not.toHaveBeenCalled();
  });
});
