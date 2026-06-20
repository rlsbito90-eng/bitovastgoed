import { describe, it, expect, vi } from 'vitest';
import {
  verwerkBagAchterstand,
  type BagBacklogInvokeResult,
  type BagBacklogProgress,
} from '@/lib/offMarket/bagBacklog/runner';

function makeIds(n: number, prefix = 'sig'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);
}

describe('verwerkBagAchterstand — snapshot-runner', () => {
  it('verwerkt iedere ID maximaal eenmaal (dedupe in snapshot)', async () => {
    const snapshot = ['a', 'b', 'a', 'c', 'b'];
    const aangeroepen: string[] = [];
    const invoke = vi.fn(async (id: string): Promise<BagBacklogInvokeResult> => {
      aangeroepen.push(id);
      return { kind: 'verrijkt' };
    });
    const r = await verwerkBagAchterstand({ snapshot, invoke });
    expect(aangeroepen.sort()).toEqual(['a', 'b', 'c']);
    expect(r.totaal).toBe(3);
    expect(r.verwerkt).toBe(3);
    expect(r.verrijkt).toBe(3);
    expect(r.resterend).toBe(0);
  });

  it('mapt alle categorieën correct, ook bij throws', async () => {
    const snapshot = makeIds(6);
    const invoke = vi.fn(async (id: string): Promise<BagBacklogInvokeResult> => {
      if (id === 'sig-1') return { kind: 'verrijkt' };
      if (id === 'sig-2') return { kind: 'meerdere_matches' };
      if (id === 'sig-3') return { kind: 'geen_match' };
      if (id === 'sig-4') return { kind: 'fout', error: 'invoke-fout' };
      if (id === 'sig-5') return { kind: 'overgeslagen' };
      throw new Error('boom');
    });
    const r = await verwerkBagAchterstand({ snapshot, invoke });
    expect(r.verwerkt).toBe(6);
    expect(r.verrijkt).toBe(1);
    expect(r.meerdere_matches).toBe(1);
    expect(r.geen_match).toBe(1);
    expect(r.overgeslagen).toBe(1);
    expect(r.fout).toBe(2); // invoke-fout + throw
    expect(r.fouten.find((f) => f.error === 'invoke-fout')).toBeTruthy();
    expect(r.fouten.find((f) => f.error === 'boom')).toBeTruthy();
  });

  it('meerdere_matches telt niet als technische fout', async () => {
    const invoke = vi.fn(async (): Promise<BagBacklogInvokeResult> => ({ kind: 'meerdere_matches' }));
    const r = await verwerkBagAchterstand({ snapshot: makeIds(3), invoke });
    expect(r.meerdere_matches).toBe(3);
    expect(r.fout).toBe(0);
    expect(r.fouten).toHaveLength(0);
  });

  it('respecteert chunkgrootte 10 en max 2 gelijktijdig', async () => {
    const snapshot = makeIds(25);
    let actief = 0;
    let piek = 0;
    const invoke = vi.fn(async (): Promise<BagBacklogInvokeResult> => {
      actief++;
      piek = Math.max(piek, actief);
      await new Promise((r) => setTimeout(r, 3));
      actief--;
      return { kind: 'verrijkt' };
    });
    await verwerkBagAchterstand({ snapshot, invoke, chunkSize: 10, concurrency: 2 });
    expect(invoke).toHaveBeenCalledTimes(25);
    expect(piek).toBeLessThanOrEqual(2);
    expect(piek).toBeGreaterThan(1);
  });

  it('throws en fouten worden binnen dezelfde run niet herhaald (geen auto-retry)', async () => {
    const aangeroepen = new Map<string, number>();
    const invoke = vi.fn(async (id: string): Promise<BagBacklogInvokeResult> => {
      aangeroepen.set(id, (aangeroepen.get(id) ?? 0) + 1);
      if (id === 'sig-1') throw new Error('boom');
      if (id === 'sig-2') return { kind: 'fout', error: 'x' };
      return { kind: 'verrijkt' };
    });
    await verwerkBagAchterstand({ snapshot: makeIds(3), invoke });
    expect(aangeroepen.get('sig-1')).toBe(1);
    expect(aangeroepen.get('sig-2')).toBe(1);
    expect(aangeroepen.get('sig-3')).toBe(1);
  });

  it('onProgress eindigt met resterend=0 en monotoon dalende resterend', async () => {
    const events: BagBacklogProgress[] = [];
    const invoke = vi.fn(async (): Promise<BagBacklogInvokeResult> => ({ kind: 'verrijkt' }));
    await verwerkBagAchterstand({
      snapshot: makeIds(10),
      invoke,
      chunkSize: 10,
      concurrency: 2,
      onProgress: (p) => events.push({ ...p }),
    });
    expect(events[events.length - 1].resterend).toBe(0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].resterend).toBeLessThanOrEqual(events[i - 1].resterend);
    }
  });

  it('lege snapshot geeft totaal=0 en roept invoke niet aan', async () => {
    const invoke = vi.fn();
    const r = await verwerkBagAchterstand({ snapshot: [], invoke });
    expect(invoke).not.toHaveBeenCalled();
    expect(r.totaal).toBe(0);
  });
});
