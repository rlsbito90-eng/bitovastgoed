// V39 — useMarkBriefVerstuurd is idempotent: tweede klik op een record
// dat al status='verstuurd' heeft mag geen tweede update of event
// veroorzaken.
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

function mockReedsVerstuurd() {
  const bestaand = {
    id: 'b1', signaal_id: 's1', kanaal: 'email',
    status: 'verstuurd', verzendstatus: 'verzonden',
    geadresseerde_key: 'k', campagne_stap: 'email_1',
    eigenaar_bedrijfsnaam: 'Demo BV', verzendadres: null,
  };
  fromMock.mockImplementation((t: string) => {
    if (t === 'off_market_brieven') {
      let kolommen = '';
      return {
        select: (cols: string) => {
          kolommen = cols;
          return {
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: 'b1', kanaal: 'email', status: 'verstuurd' },
                error: null,
              }),
              single: () => Promise.resolve({ data: bestaand, error: null }),
            }),
          };
        },
        update: (patch: any) => {
          updateMock(patch);
          return {
            eq: () => ({
              select: () => ({ single: () => Promise.resolve({ data: bestaand, error: null }) }),
            }),
          };
        },
      };
    }
    if (t === 'off_market_brief_events') return { insert: insertEvents };
    return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
  });
}

describe('useMarkBriefVerstuurd — idempotent', () => {
  it('reeds verstuurd record veroorzaakt geen update en geen event', async () => {
    mockReedsVerstuurd();
    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    const ret = await result.current.mutateAsync({
      id: 'b1', postdatum: '2026-06-24', kanaal: 'email',
    });
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertEvents).not.toHaveBeenCalled();
    expect(ret).toMatchObject({ id: 'b1', status: 'verstuurd' });
  });
});
