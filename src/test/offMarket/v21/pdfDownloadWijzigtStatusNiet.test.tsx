// V2.1 — PDF-download (useUpdateVerzendstatus → pdf_gegenereerd) raakt
// off_market_signalen niet. Bewijs: signaaltabel-mock zou throwen.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertEvents = vi.fn((_p: any) => Promise.resolve({ error: null }));
const updateBriefMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } } }) },
    from: (t: string) => fromMock(t),
  },
}));

beforeEach(() => {
  insertEvents.mockClear();
  updateBriefMock.mockClear();
  fromMock.mockReset();
});

import { useUpdateVerzendstatus } from '@/hooks/useUpdateVerzendstatus';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useUpdateVerzendstatus — PDF-download raakt signaalstatus niet', () => {
  it('alleen brief-update + event, geen off_market_signalen mutation', async () => {
    fromMock.mockImplementation((t: string) => {
      if (t === 'off_market_brieven') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'b-1', verzendstatus: 'concept', signaal_id: 's1' },
                error: null,
              }),
            }),
          }),
          update: (patch: any) => {
            updateBriefMock(patch);
            return {
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({
                    data: { id: 'b-1', signaal_id: 's1', verzendstatus: 'pdf_gegenereerd' },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }
      if (t === 'off_market_brief_events') return { insert: insertEvents };
      throw new Error('onverwachte tabel ' + t);
    });

    const { result } = renderHook(() => useUpdateVerzendstatus(), { wrapper: wrap() });
    await result.current.mutateAsync({
      id: 'b-1', signaal_id: 's1', nieuweStatus: 'pdf_gegenereerd', event: 'pdf_generated',
    });
    expect(updateBriefMock).toHaveBeenCalledWith({ verzendstatus: 'pdf_gegenereerd' });
  });
});
