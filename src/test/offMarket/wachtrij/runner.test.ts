import { describe, it, expect, vi } from 'vitest';
import {
  verwerkVolledigeWachtrij,
  clampBatchSize,
  HARD_CAP_RECORDS,
  MAX_BATCH,
} from '@/lib/offMarket/wachtrij/runner';

function chunk(verwerkt: number, extra: Partial<{ gepromoveerd: number; merged: number; geskipt: number; fouten: number }> = {}) {
  return { verwerkt, gepromoveerd: 0, merged: 0, geskipt: 0, fouten: 0, ...extra };
}

describe('clampBatchSize', () => {
  it('caps boven 1000', () => {
    expect(clampBatchSize(5000)).toBe(MAX_BATCH);
    expect(clampBatchSize(1000)).toBe(1000);
  });
  it('staat 100/200/500/1000 toe', () => {
    expect(clampBatchSize(100)).toBe(100);
    expect(clampBatchSize(200)).toBe(200);
    expect(clampBatchSize(500)).toBe(500);
    expect(clampBatchSize(1000)).toBe(1000);
  });
  it('valt terug op 200 bij ongeldige input', () => {
    expect(clampBatchSize(0)).toBe(200);
    expect(clampBatchSize(-1)).toBe(200);
    expect(clampBatchSize(NaN)).toBe(200);
  });
});

describe('verwerkVolledigeWachtrij', () => {
  it('geeft batchSize correct door aan runChunk', async () => {
    const calls: number[] = [];
    const runChunk = vi.fn(async (a: { limit: number }) => {
      calls.push(a.limit);
      return chunk(0); // direct leeg
    });
    await verwerkVolledigeWachtrij({ batchSize: 500, runChunk });
    expect(calls).toEqual([500]);
  });

  it('cap batchSize boven 1000 naar 1000', async () => {
    const calls: number[] = [];
    const runChunk = vi.fn(async (a: { limit: number }) => {
      calls.push(a.limit);
      return chunk(0);
    });
    await verwerkVolledigeWachtrij({ batchSize: 9999, runChunk });
    expect(calls[0]).toBe(MAX_BATCH);
  });

  it('loopt meerdere chunks tot wachtrij leeg is', async () => {
    let n = 0;
    const sizes = [200, 200, 50]; // laatste < batchSize → stop
    const runChunk = vi.fn(async () => chunk(sizes[n++]));
    const r = await verwerkVolledigeWachtrij({ batchSize: 200, runChunk });
    expect(r.chunks).toBe(3);
    expect(r.verwerkt).toBe(450);
    expect(r.foutmelding).toBeUndefined();
    expect(r.afgekapt).toBe(false);
  });

  it('stopt zodra verwerkt < batchSize', async () => {
    const runChunk = vi.fn(async () => chunk(199)); // < 200
    const r = await verwerkVolledigeWachtrij({ batchSize: 200, runChunk });
    expect(r.chunks).toBe(1);
    expect(runChunk).toHaveBeenCalledTimes(1);
  });

  it('stopt netjes bij fout en geeft foutmelding terug', async () => {
    let n = 0;
    const runChunk = vi.fn(async () => {
      n++;
      if (n === 2) throw new Error('boom');
      return chunk(200);
    });
    const r = await verwerkVolledigeWachtrij({ batchSize: 200, runChunk });
    expect(r.chunks).toBe(1); // alleen succesvolle chunks geteld
    expect(r.verwerkt).toBe(200);
    expect(r.foutmelding).toBe('boom');
  });

  it('respecteert hard cap totaal records', async () => {
    const runChunk = vi.fn(async (a: { limit: number }) => chunk(a.limit));
    const r = await verwerkVolledigeWachtrij({
      batchSize: 200, runChunk, maxRecords: 600,
    });
    expect(r.verwerkt).toBe(600);
    expect(r.afgekapt).toBe(true);
    expect(runChunk).toHaveBeenCalledTimes(3);
  });

  it('respecteert maxDurationMs', async () => {
    let t = 0;
    const now = () => { const v = t; t += 60_000; return v; };
    const runChunk = vi.fn(async (a: { limit: number }) => chunk(a.limit));
    const r = await verwerkVolledigeWachtrij({
      batchSize: 200, runChunk, now, maxDurationMs: 120_000,
    });
    expect(r.afgekapt).toBe(true);
    expect(runChunk.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('roept onProgress aan na elke chunk', async () => {
    let n = 0;
    const sizes = [200, 200, 0];
    const runChunk = vi.fn(async () => chunk(sizes[n++]));
    const events: Array<[number, number]> = [];
    await verwerkVolledigeWachtrij({
      batchSize: 200,
      runChunk,
      onProgress: (t, c) => events.push([t, c]),
    });
    expect(events).toEqual([[200, 1], [400, 2], [400, 3]]);
  });

  it('geeft bronId door aan runChunk', async () => {
    const runChunk = vi.fn(async () => chunk(0));
    await verwerkVolledigeWachtrij({ batchSize: 100, bronId: 'abc', runChunk });
    expect(runChunk).toHaveBeenCalledWith({ limit: 100, bronId: 'abc' });
  });

  it('aggregeert counters correct', async () => {
    let n = 0;
    const results = [
      chunk(200, { gepromoveerd: 5, merged: 1, geskipt: 10, fouten: 0 }),
      chunk(150, { gepromoveerd: 3, merged: 2, geskipt: 5, fouten: 1 }),
    ];
    const runChunk = vi.fn(async () => results[n++]);
    const r = await verwerkVolledigeWachtrij({ batchSize: 200, runChunk });
    expect(r.gepromoveerd).toBe(8);
    expect(r.merged).toBe(3);
    expect(r.geskipt).toBe(15);
    expect(r.fouten).toBe(1);
  });

  it('hard cap absoluut maximum is HARD_CAP_RECORDS ongeacht override', async () => {
    const runChunk = vi.fn(async (a: { limit: number }) => chunk(a.limit));
    const r = await verwerkVolledigeWachtrij({
      batchSize: 1000, runChunk, maxRecords: 999_999,
    });
    expect(r.verwerkt).toBeLessThanOrEqual(HARD_CAP_RECORDS);
  });
});
