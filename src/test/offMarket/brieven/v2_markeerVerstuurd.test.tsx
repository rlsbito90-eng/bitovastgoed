// Brieven V2 — markeer verstuurd: postdatum bepaalt opvolgdatum (postdatum + 21),
// taak wordt aangemaakt, gekoppelde_taak_id wordt gevuld, events worden
// geschreven.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';

// We mocken supabase volledig — onafhankelijke unit test op de mutatielaag.
const insertMock = vi.fn((_payload: any) => Promise.resolve({ error: null }));
const updateMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: (t: string) => fromMock(t),
  },
}));

beforeEach(() => {
  insertMock.mockClear();
  updateMock.mockClear();
  fromMock.mockReset();
});

import { useMarkBriefVerstuurd } from '@/hooks/useOffMarketBrieven';

describe('useMarkBriefVerstuurd — V2', () => {
  it('postdatum bepaalt opvolgdatum (postdatum + 21)', () => {
    expect(berekenFollowUpDeadline('2026-06-01')).toBe('2026-06-22');
  });

  it('mutation update zet verzendstatus=gepost, postdatum, opvolgdatum, gekoppelde_taak_id en schrijft posted+follow_up_created events', async () => {
    const updatedRow = {
      id: 'b-1', signaal_id: 's1',
      geadresseerde_key: 'alfa', campagne_stap: 'brief_1', kanaal: 'post',
      verzendstatus: 'gepost', postdatum: '2026-06-01', opvolgdatum: '2026-06-22',
      status: 'verstuurd', verzonden_op: '2026-06-01T12:00:00.000Z',
      gekoppelde_taak_id: 't-1',
    };
    fromMock.mockImplementation((tabel: string) => {
      if (tabel === 'off_market_brieven') {
        return {
          update: (patch: any) => {
            updateMock(patch);
            return {
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: updatedRow, error: null }),
                }),
              }),
            };
          },
        };
      }
      if (tabel === 'off_market_brief_events') {
        return { insert: insertMock };
      }
      throw new Error(`onverwachte tabel ${tabel}`);
    });

    const { result } = renderUseMutation(useMarkBriefVerstuurd);
    const out = await result.current.mutateAsync({
      id: 'b-1', postdatum: '2026-06-01', gekoppelde_taak_id: 't-1',
    });

    expect(out.gekoppelde_taak_id).toBe('t-1');
    // Update bevat alle V2 velden
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'verstuurd',
      verzendstatus: 'gepost',
      postdatum: '2026-06-01',
      opvolgdatum: '2026-06-22',
      gekoppelde_taak_id: 't-1',
    }));
    // Twee events: posted + follow_up_created
    const eventTypes = insertMock.mock.calls.map((c: any[]) => c[0].event_type);
    expect(eventTypes).toContain('posted');
    expect(eventTypes).toContain('follow_up_created');
  });
});

// Mini-helper: maak een query-client en wrapper voor useMutation-hooks.
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
function renderUseMutation<T extends (...a: any[]) => any>(hook: T) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => hook(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  });
}
