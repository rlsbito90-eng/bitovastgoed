// V2.4 — Safety: mergeBagContext is puur en doet geen netwerk-/Kadaster-calls.
import { describe, it, expect, vi } from 'vitest';
import { mergeBagContext } from '@/lib/offMarket/bag/contextMerge';

describe('BAG context merge — geen automatische Kadaster-call', () => {
  it('roept geen fetch aan tijdens merge', () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockImplementation(() => {
      throw new Error('fetch should not be called');
    });
    const res = mergeBagContext({
      pandidVbos: [],
      huisnummerVbos: [
        { vbo_id: 'v1', nummeraanduiding_id: 'n1', adres: 'A', opp_m2: 50, gebruiksdoel: [], status: null, pandid: null },
      ],
      selected: { vbo_id: 'v1', nummeraanduiding_id: 'n1', pandid: null, adres: 'A' },
    });
    expect(res.aantal).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
