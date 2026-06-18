// V2.2 — Hook-tests voor markeer e-mail verzonden:
// verzendstatus, opvolgdatum (+7), event-type 'sent' en statuspromotie.
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
    id: 'b1', signaal_id: 's1', geadresseerde_key: 'k',
    campagne_stap: 'email_1', kanaal: 'email',
    verzendstatus: 'verzonden', status: 'verstuurd',
  };
  fromMock.mockImplementation((t: string) => {
    if (t === 'off_market_brieven') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: { id: 'b1', kanaal: 'email' }, error: null,
            }),
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

describe('useMarkBriefVerstuurd — kanaal=email', () => {
  it('zet verzendstatus=verzonden en opvolgdatum = postdatum + 7', async () => {
    mockSupabase('eigenaar_gevonden');
    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    await result.current.mutateAsync({
      id: 'b1', postdatum: '2026-06-01', kanaal: 'email', email_profiel: 'algemene_acquisitie',
    });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      verzendstatus: 'verzonden',
      postdatum: '2026-06-01',
      opvolgdatum: '2026-06-08',
      status: 'verstuurd',
    }));
    const types = insertEvents.mock.calls.map((c: any[]) => c[0].event_type);
    expect(types).toContain('sent');
    // sent-event bevat email metadata
    const sentCall = insertEvents.mock.calls.find((c: any[]) => c[0].event_type === 'sent');
    expect(sentCall?.[0].metadata).toMatchObject({ kanaal: 'email', email_profiel: 'algemene_acquisitie' });
  });

  it('promoveert signaalstatus naar benaderd vanuit eerdere fase', async () => {
    mockSupabase('eigenaar_gevonden');
    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 'b1', postdatum: '2026-06-01', kanaal: 'email' });
    expect(signaalUpdateMock).toHaveBeenCalledWith({ status: 'benaderd' });
  });

  it('overschrijft latere status (afgevallen) NIET', async () => {
    mockSupabase('afgevallen');
    const { result } = renderHook(() => useMarkBriefVerstuurd(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 'b1', postdatum: '2026-06-01', kanaal: 'email' });
    expect(signaalUpdateMock).not.toHaveBeenCalled();
  });
});
