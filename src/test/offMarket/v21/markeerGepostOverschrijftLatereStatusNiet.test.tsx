// V2.1 — markeer gepost mag latere/eindstatussen niet overschrijven.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertEvents = vi.fn((_p: any) => Promise.resolve({ error: null }));
const updateMock = vi.fn();
const signaalUpdateMock = vi.fn();
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
  signaalUpdateMock.mockClear();
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

function mockSupabase(huidigeStatus: string) {
  const updatedRow = {
    id: 'b1', signaal_id: 's1', geadresseerde_key: 'k', campagne_stap: 'brief_1',
    kanaal: 'post', verzendstatus: 'gepost', status: 'verstuurd',
  };
  fromMock.mockImplementation((t: string) => {
    if (t === 'off_market_brieven') {
      return {
        update: () => ({
          eq: () => ({
            select: () => ({ single: () => Promise.resolve({ data: updatedRow, error: null }) }),
          }),
        }),
      };
    }
    if (t === 'off_market_brief_events') return { insert: insertEvents };
    if (t === 'off_market_signalen') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: 's1', status: huidigeStatus }, error: null }),
          }),
        }),
        update: (patch: any) => {
          signaalUpdateMock(patch);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    }
    throw new Error('onverwachte tabel ' + t);
  });
}

describe('useMarkBriefVerstuurd — geen statusoverride bij latere fases', () => {
  it('in_gesprek blijft in_gesprek', async () => {
    mockSupabase('in_gesprek');
    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 'b1', postdatum: '2026-06-01' });
    expect(signaalUpdateMock).not.toHaveBeenCalled();
  });

  it('niet_interessant blijft niet_interessant', async () => {
    mockSupabase('niet_interessant');
    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 'b1', postdatum: '2026-06-01' });
    expect(signaalUpdateMock).not.toHaveBeenCalled();
  });

  it('benaderd blijft ongewijzigd (geen dubbele update)', async () => {
    mockSupabase('benaderd');
    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 'b1', postdatum: '2026-06-01' });
    expect(signaalUpdateMock).not.toHaveBeenCalled();
  });
});
