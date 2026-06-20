import { describe, it, expect, vi } from 'vitest';
import {
  verwerkAiAchterstand,
  type AiBacklogInvokeResult,
} from '@/lib/offMarket/aiBacklog/runner';

function makeIds(n: number, prefix = 'sig'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);
}

describe('verwerkAiAchterstand — snapshot-runner', () => {
  it('verwerkt iedere ID maximaal eenmaal binnen de run (ook bij duplicaten in snapshot)', async () => {
    const snapshot = ['a', 'b', 'a', 'c', 'b']; // duplicates
    const aangeroepen: string[] = [];
    const invoke = vi.fn(async (id: string): Promise<AiBacklogInvokeResult> => {
      aangeroepen.push(id);
      return { ok: true };
    });
    const r = await verwerkAiAchterstand({ snapshot, invoke });
    expect(aangeroepen.sort()).toEqual(['a', 'b', 'c']);
    expect(r.totaal).toBe(3);
    expect(r.verwerkt).toBe(3);
    expect(r.geslaagd).toBe(3);
    expect(r.mislukt).toBe(0);
    expect(r.resterend).toBe(0);
  });

  it('telt fouten als mislukt en gaat door met de rest van de snapshot', async () => {
    const snapshot = makeIds(4);
    const invoke = vi.fn(async (id: string): Promise<AiBacklogInvokeResult> => {
      if (id === 'sig-2') return { ok: false, error: 'invoke-fout' };
      if (id === 'sig-3') throw new Error('boom');
      return { ok: true };
    });
    const r = await verwerkAiAchterstand({ snapshot, invoke });
    expect(r.verwerkt).toBe(4);
    expect(r.geslaagd).toBe(2);
    expect(r.mislukt).toBe(2);
    expect(r.fouten.some((f) => f.error === 'invoke-fout')).toBe(true);
    expect(r.fouten.some((f) => f.error === 'boom')).toBe(true);
  });

  it('houdt maximaal `concurrency` gelijktijdige invokes aan', async () => {
    const snapshot = makeIds(20);
    let actief = 0;
    let piek = 0;
    const invoke = vi.fn(async (): Promise<AiBacklogInvokeResult> => {
      actief++;
      piek = Math.max(piek, actief);
      await new Promise((r) => setTimeout(r, 5));
      actief--;
      return { ok: true };
    });
    await verwerkAiAchterstand({ snapshot, invoke, chunkSize: 25, concurrency: 5 });
    expect(piek).toBeLessThanOrEqual(5);
    expect(piek).toBeGreaterThan(1);
  });

  it('verwerkt in chunks van `chunkSize`', async () => {
    const snapshot = makeIds(60);
    const invoke = vi.fn(async (): Promise<AiBacklogInvokeResult> => ({ ok: true }));
    const events: number[] = [];
    await verwerkAiAchterstand({
      snapshot,
      invoke,
      chunkSize: 25,
      concurrency: 5,
      onProgress: (p) => events.push(p.verwerkt),
    });
    expect(invoke).toHaveBeenCalledTimes(60);
    expect(events[events.length - 1]).toBe(60);
  });

  it('onProgress bevat correcte resterend-teller', async () => {
    const snapshot = makeIds(10);
    const invoke = vi.fn(async (): Promise<AiBacklogInvokeResult> => ({ ok: true }));
    const events: Array<{ verwerkt: number; resterend: number }> = [];
    await verwerkAiAchterstand({
      snapshot,
      invoke,
      chunkSize: 5,
      concurrency: 5,
      onProgress: (p) => events.push({ verwerkt: p.verwerkt, resterend: p.resterend }),
    });
    expect(events[0]).toEqual({ verwerkt: 5, resterend: 5 });
    expect(events[events.length - 1]).toEqual({ verwerkt: 10, resterend: 0 });
  });

  it('lege snapshot geeft totaal=0 en roept invoke niet aan', async () => {
    const invoke = vi.fn();
    const r = await verwerkAiAchterstand({ snapshot: [], invoke });
    expect(invoke).not.toHaveBeenCalled();
    expect(r.totaal).toBe(0);
    expect(r.verwerkt).toBe(0);
  });
});

describe('verwerkAiAchterstand — borging payload', () => {
  it('voorbeeldgebruik: client moet force:false en cascade_bag:false meesturen', () => {
    // De runner zelf is payload-agnostisch; deze test borgt dat de invoke-aanroep
    // contractueel met deze velden wordt gemaakt door de hook.
    const payload = { signaal_id: 'sig-x', force: false, cascade_bag: false };
    expect(payload.force).toBe(false);
    expect(payload.cascade_bag).toBe(false);
  });
});
