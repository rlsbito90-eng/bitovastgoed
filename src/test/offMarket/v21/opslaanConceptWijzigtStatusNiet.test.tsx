// V2.1 — Opslaan als concept (useUpsertBrief) wijzigt signaalstatus niet.
// We bewijzen dit door alleen off_market_brieven en off_market_brief_events
// te mocken. Als de hook de signaaltabel zou benaderen, faalt de test.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertEvents = vi.fn((_p: any) => Promise.resolve({ error: null }));
const insertBrief = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: (t: string) => fromMock(t),
  },
}));

beforeEach(() => {
  insertEvents.mockClear();
  insertBrief.mockClear();
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

describe('useUpsertBrief — opslaan concept wijzigt signaalstatus niet', () => {
  it('roept GEEN off_market_signalen.update aan', async () => {
    const createdRow = {
      id: 'b-new', signaal_id: 's1', status: 'concept',
    };
    fromMock.mockImplementation((t: string) => {
      if (t === 'off_market_brieven') {
        return {
          insert: (p: any) => {
            insertBrief(p);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: createdRow, error: null }),
              }),
            };
          },
        };
      }
      if (t === 'off_market_brief_events') return { insert: insertEvents };
      // Alles anders is fout — bewijst geen signaal-mutatie.
      throw new Error('onverwachte tabel ' + t);
    });

    const { result } = renderHook(() => useUpsertBrief(), { wrapper: wrap() });
    await result.current.mutateAsync({
      signaal_id: 's1',
      brieftekst: 'tekst',
      eigenaar_naam: 'X',
    });
    expect(insertBrief).toHaveBeenCalled();
    expect(insertBrief.mock.calls[0][0]).toMatchObject({ status: 'concept' });
    // De test slaagt: fromMock zou hebben gegooid bij off_market_signalen.
  });
});
