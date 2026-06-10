// Fase 4K.4E — bij promotie Signaal → Object kunnen bestaande
// Kadasterrecords worden meegenomen door object_id te vullen, terwijl
// signaal_id behouden blijft. Er wordt nooit een nieuwe Kadaster-call
// gedaan tijdens promotie.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

const rpcMock = vi.fn();
const updateSelectMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpcMock(...a),
    from: (t: string) => fromMock(t),
  },
}));

import { usePromoteSignaalToObject } from '@/hooks/useOffMarketLinks';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  rpcMock.mockReset();
  updateSelectMock.mockReset();
  fromMock.mockReset();

  // chainable mock voor .from('kadaster_data_records').update().eq().is().select()
  fromMock.mockImplementation((_t: string) => ({
    update: (vals: Record<string, unknown>) => ({
      eq: (_k: string, _v: string) => ({
        is: (_k2: string, _v2: null) => ({
          select: (_c: string) => updateSelectMock(vals),
        }),
      }),
    }),
  }));
});

describe('usePromoteSignaalToObject — Kadaster-migratie', () => {
  it('doet geen kadaster-update wanneer migrateKadaster=false', async () => {
    rpcMock.mockResolvedValue({ data: 'obj-1', error: null });

    const { result } = renderHook(() => usePromoteSignaalToObject(), { wrapper });
    const res = await result.current.mutateAsync({ signaalId: 'sig-1', migrateKadaster: false });

    expect(rpcMock).toHaveBeenCalledWith('off_market_promote_to_object', { _signaal_id: 'sig-1' });
    expect(updateSelectMock).not.toHaveBeenCalled();
    expect(res.objectId).toBe('obj-1');
    expect(res.kadasterMigrated).toBe(0);
    expect(res.kadasterMigrationError).toBeNull();
  });

  it('zet object_id op bestaande records bij migrateKadaster=true (signaal_id blijft)', async () => {
    rpcMock.mockResolvedValue({ data: 'obj-2', error: null });
    updateSelectMock.mockResolvedValue({
      data: [{ id: 'r1' }, { id: 'r2' }],
      error: null,
    });

    const { result } = renderHook(() => usePromoteSignaalToObject(), { wrapper });
    const res = await result.current.mutateAsync({ signaalId: 'sig-2', migrateKadaster: true });

    expect(updateSelectMock).toHaveBeenCalledTimes(1);
    expect(updateSelectMock).toHaveBeenCalledWith({ object_id: 'obj-2' });
    expect(res.kadasterMigrated).toBe(2);
    expect(res.kadasterMigrationError).toBeNull();
  });

  it('rolt het object niet terug als kadaster-koppeling mislukt; geeft foutmelding mee', async () => {
    rpcMock.mockResolvedValue({ data: 'obj-3', error: null });
    updateSelectMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const { result } = renderHook(() => usePromoteSignaalToObject(), { wrapper });
    const res = await result.current.mutateAsync({ signaalId: 'sig-3', migrateKadaster: true });

    expect(res.objectId).toBe('obj-3');
    expect(res.kadasterMigrated).toBe(0);
    expect(res.kadasterMigrationError).toMatch(/permission denied/);
  });

  it('doet geen extra Kadaster Edge Function call tijdens promotie', async () => {
    rpcMock.mockResolvedValue({ data: 'obj-4', error: null });
    updateSelectMock.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => usePromoteSignaalToObject(), { wrapper });
    await result.current.mutateAsync({ signaalId: 'sig-4', migrateKadaster: true });

    // alleen de promote-RPC; geen rpc('kadaster-objectinformatie') of iets vergelijkbaars
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][0]).toBe('off_market_promote_to_object');
  });
});
