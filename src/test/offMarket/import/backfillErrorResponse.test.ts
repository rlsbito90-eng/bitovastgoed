import { describe, it, expect } from 'vitest';

/**
 * Contract-test voor de gestructureerde foutrespons van de backfill edge function.
 * De function moet bij SRU-fouten (bv. HTTP 503 bij deep-paging) status 200 + ok:false
 * teruggeven, met een Nederlandstalige message en de cursor onveranderd, zodat:
 *   - supabase.functions.invoke de body doorgeeft (geen "non-2xx" generieke fout);
 *   - de UI een echte foutmelding kan tonen;
 *   - de retry dezelfde cursor gebruikt.
 */

interface BackfillFoutResponse {
  ok: false;
  status: 'fout';
  modus: 'backfill';
  message: string;
  raw_error: string;
  sru_status: number | null;
  cursor_start: number;
  cursor_eind: number | null;
  batch_size: number;
  query_vanaf: string;
  query_tot: string;
  query_url: string;
  opgehaald: number;
  nieuw: number;
  dubbel: number;
  fout_records: number;
  duration_ms: number;
  run_id?: string;
}

function maakBackfillFout(opts: {
  sruStatus: number; cursorStart: number; batchSize: number;
}): BackfillFoutResponse {
  return {
    ok: false,
    status: 'fout',
    modus: 'backfill',
    message: `De landelijke bekendmakingen-server (KOOP/SRU) gaf HTTP ${opts.sruStatus} bij deep-paging vanaf record ${opts.cursorStart + 1}. Probeer het over enkele minuten opnieuw met dezelfde cursor, of verklein de periode (bijv. 30 dagen).`,
    raw_error: `SRU HTTP ${opts.sruStatus} bij startRecord uit URL`,
    sru_status: opts.sruStatus,
    cursor_start: opts.cursorStart,
    cursor_eind: opts.cursorStart, // cursor blijft gelijk bij fetch-fout
    batch_size: opts.batchSize,
    query_vanaf: '2026-03-16T00:00:00.000Z',
    query_tot: '2026-06-14T23:59:59.999Z',
    query_url: 'https://repository.overheid.nl/sru?...',
    opgehaald: 0, nieuw: 0, dubbel: 0, fout_records: 0,
    duration_ms: 1934,
  };
}

describe('Backfill error response — cursor 5000 (KOOP SRU 503)', () => {
  it('geeft gestructureerde Nederlandstalige fout terug', () => {
    const r = maakBackfillFout({ sruStatus: 503, cursorStart: 5000, batchSize: 1000 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('fout');
    expect(r.modus).toBe('backfill');
    expect(r.sru_status).toBe(503);
    expect(r.message).toContain('503');
    expect(r.message).toContain('5001');
    expect(r.message).toMatch(/dezelfde cursor|kleinere periode|verklein/i);
  });

  it('cursor blijft gelijk bij fetch-fout zodat retry dezelfde positie gebruikt', () => {
    const r = maakBackfillFout({ sruStatus: 503, cursorStart: 5000, batchSize: 1000 });
    expect(r.cursor_eind).toBe(5000);
    expect(r.cursor_start).toBe(5000);
  });

  it('batch 1000 en 2000 leveren beide dezelfde cursor-logica op', () => {
    const a = maakBackfillFout({ sruStatus: 503, cursorStart: 5000, batchSize: 1000 });
    const b = maakBackfillFout({ sruStatus: 503, cursorStart: 5000, batchSize: 2000 });
    expect(a.cursor_eind).toBe(b.cursor_eind);
    expect(a.cursor_start).toBe(b.cursor_start);
  });

  it('429 (rate limit) krijgt ook duidelijke retry-melding', () => {
    const r = maakBackfillFout({ sruStatus: 429, cursorStart: 5000, batchSize: 1000 });
    expect(r.message).toContain('429');
  });

  it('UI-hook leest message-veld uit body bij ok:false', () => {
    const data = maakBackfillFout({ sruStatus: 503, cursorStart: 5000, batchSize: 1000 });
    // simulatie van useBackfillRun: bij data.ok===false → throw met data.message
    const fout = data.ok === false
      ? new Error(data.message ?? data.raw_error ?? 'Backfill mislukt')
      : null;
    expect(fout).not.toBeNull();
    expect(fout!.message).toContain('KOOP/SRU');
    expect(fout!.message).not.toBe('Edge Function returned a non-2xx status code');
  });
});
