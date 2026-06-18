// Brieven V2 — PDF-download op een bestaande brief mag geen insert doen
// op off_market_brieven. Wel een audit-event pdf_generated.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn(() => Promise.resolve({ error: null }));
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

import { useUpdateVerzendstatus } from '@/hooks/useUpdateVerzendstatus';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: any) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('PDF-download upgrade — V2', () => {
  it('upgrade van concept → pdf_gegenereerd doet UPDATE en INSERT op events; geen INSERT op brieven', async () => {
    fromMock.mockImplementation((tabel: string) => {
      if (tabel === 'off_market_brieven') {
        return {
          // Eerste read: huidige verzendstatus
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'b-1', verzendstatus: 'concept', signaal_id: 's1' },
                error: null,
              }),
            }),
          }),
          update: (patch: any) => {
            updateMock(patch);
            return {
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({
                    data: {
                      id: 'b-1', signaal_id: 's1', verzendstatus: 'pdf_gegenereerd',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          },
          // Insert nooit toegestaan in dit pad
          insert: (...args: any[]) => {
            throw new Error('PDF-download zou GEEN insert op off_market_brieven mogen doen');
          },
        };
      }
      if (tabel === 'off_market_brief_events') {
        return { insert: insertMock };
      }
      throw new Error(`onverwachte tabel ${tabel}`);
    });

    const { result } = renderHook(() => useUpdateVerzendstatus(), { wrapper: wrap() });
    await result.current.mutateAsync({
      id: 'b-1',
      signaal_id: 's1',
      nieuweStatus: 'pdf_gegenereerd',
      event: 'pdf_generated',
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ verzendstatus: 'pdf_gegenereerd' }),
    );
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      brief_id: 'b-1',
      event_type: 'pdf_generated',
    });
  });
});
