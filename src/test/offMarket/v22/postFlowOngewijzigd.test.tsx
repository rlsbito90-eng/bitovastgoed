// V2.2 — Postflow blijft ongewijzigd:
//  * useUpsertBrief schrijft kanaal='post' wanneer expliciet meegegeven
//  * markeer post verstuurd zet verzendstatus='gepost' en opvolgdatum +21.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertEvents = vi.fn((_p: any) => Promise.resolve({ error: null }));
const updateMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: (t: string) => fromMock(t),
  },
}));

beforeEach(() => {
  insertEvents.mockClear();
  updateMock.mockClear();
  fromMock.mockReset();
});

import { useMarkBriefVerstuurd } from '@/hooks/useOffMarketBrieven';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('Postflow ongewijzigd — V2.2', () => {
  it('markeer post verstuurd zet verzendstatus=gepost en opvolgdatum +21', async () => {
    const updatedRow = {
      id: 'b1', signaal_id: 's1', geadresseerde_key: 'k',
      campagne_stap: 'brief_1', kanaal: 'post',
      verzendstatus: 'gepost', status: 'verstuurd',
    };
    fromMock.mockImplementation((t: string) => {
      if (t === 'off_market_brieven') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: 'b1', kanaal: 'post' }, error: null }),
            }),
          }),
          update: (patch: any) => {
            updateMock(patch);
            return {
              eq: () => ({
                select: () => ({ single: () => Promise.resolve({ data: updatedRow, error: null }) }),
              }),
            };
          },
        };
      }
      if (t === 'off_market_brief_events') return { insert: insertEvents };
      throw new Error('onverwachte tabel ' + t);
    });

    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 'b1', postdatum: '2026-06-01' });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      verzendstatus: 'gepost', postdatum: '2026-06-01', opvolgdatum: '2026-06-22',
    }));
    const types = insertEvents.mock.calls.map((c: any[]) => c[0].event_type);
    expect(types).toContain('posted');
    expect(types).not.toContain('sent');
  });
});
