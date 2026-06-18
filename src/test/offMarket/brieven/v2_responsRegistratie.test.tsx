// Brieven V2 — useRegistreerRespons schrijft response-velden + event,
// retour_post zet verzendstatus naar retour.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const eventInsertMock = vi.fn((_payload: any) => Promise.resolve({ error: null }));
const briefUpdateMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: (t: string) => fromMock(t),
  },
}));

beforeEach(() => {
  eventInsertMock.mockClear();
  briefUpdateMock.mockClear();
  fromMock.mockReset();
  fromMock.mockImplementation((tabel: string) => {
    if (tabel === 'off_market_brieven') {
      return {
        update: (patch: any) => {
          briefUpdateMock(patch);
          return {
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: 'b-1', signaal_id: 's1', ...patch },
                  error: null,
                }),
              }),
            }),
          };
        },
      };
    }
    if (tabel === 'off_market_brief_events') return { insert: eventInsertMock };
    throw new Error(`onverwachte tabel ${tabel}`);
  });
});

import { useRegistreerRespons } from '@/hooks/useRegistreerRespons';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('responsRegistratie — V2', () => {
  it('slaat responsstatus/datum/samenvatting op en schrijft response_received event', async () => {
    const { result } = renderHook(() => useRegistreerRespons(), { wrapper: wrap() });
    await result.current.mutateAsync({
      brief_id: 'b-1',
      signaal_id: 's1',
      responsstatus: 'interesse',
      responsdatum: '2026-06-15',
      respons_kanaal: 'email',
      respons_samenvatting: 'Wil bellen volgende week.',
    });
    expect(briefUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      responsstatus: 'interesse',
      responsdatum: '2026-06-15',
      respons_samenvatting: 'Wil bellen volgende week.',
    }));
    expect(eventInsertMock).toHaveBeenCalledTimes(1);
    expect(eventInsertMock.mock.calls[0][0]).toMatchObject({
      event_type: 'response_received',
      status: 'interesse',
    });
  });

  it('retour_post zet verzendstatus=retour en schrijft returned_mail event', async () => {
    const { result } = renderHook(() => useRegistreerRespons(), { wrapper: wrap() });
    await result.current.mutateAsync({
      brief_id: 'b-1',
      signaal_id: 's1',
      responsstatus: 'retour_post',
      responsdatum: '2026-06-15',
      respons_kanaal: 'post',
    });
    expect(briefUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      responsstatus: 'retour_post',
      verzendstatus: 'retour',
    }));
    expect(eventInsertMock.mock.calls[0][0]).toMatchObject({
      event_type: 'returned_mail',
    });
  });
});
