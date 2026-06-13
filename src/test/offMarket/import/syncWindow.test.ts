import { describe, it, expect } from 'vitest';
import { bepaalSyncWindow, bepaalModus, isoDatum } from '@/lib/offMarket/import/syncWindow';

const NOW = new Date('2026-06-13T10:00:00Z');

describe('bepaalSyncWindow', () => {
  it('gebruikt lookback_days_default als laatste_sync_op ontbreekt', () => {
    const w = bepaalSyncWindow({
      now: NOW, laatsteSyncOp: null,
      lookbackDaysDefault: 7, lookbackOverlapUren: 24,
    });
    expect(w.reden).toBe('eerste_sync_lookback_default');
    expect(w.tot.toISOString()).toBe(NOW.toISOString());
    expect(w.vanaf.toISOString()).toBe(new Date('2026-06-06T10:00:00Z').toISOString());
  });

  it('gebruikt laatste_sync_op - overlap_uren als laatste_sync_op aanwezig is', () => {
    const laatste = new Date('2026-06-12T10:00:00Z');
    const w = bepaalSyncWindow({
      now: NOW, laatsteSyncOp: laatste,
      lookbackDaysDefault: 7, lookbackOverlapUren: 24,
    });
    expect(w.reden).toBe('laatste_sync_min_overlap');
    expect(w.vanaf.toISOString()).toBe(new Date('2026-06-11T10:00:00Z').toISOString());
    expect(w.tot.toISOString()).toBe(NOW.toISOString());
  });

  it('hanteert overlap=0 zonder fouten', () => {
    const laatste = new Date('2026-06-12T10:00:00Z');
    const w = bepaalSyncWindow({
      now: NOW, laatsteSyncOp: laatste,
      lookbackDaysDefault: 7, lookbackOverlapUren: 0,
    });
    expect(w.vanaf.toISOString()).toBe(laatste.toISOString());
  });

  it('clampt het venster op maximaal 365 dagen', () => {
    const w = bepaalSyncWindow({
      now: NOW, laatsteSyncOp: null,
      lookbackDaysDefault: 999, lookbackOverlapUren: 24,
    });
    const diffDagen = (w.tot.getTime() - w.vanaf.getTime()) / 86400_000;
    expect(diffDagen).toBeLessThanOrEqual(365);
  });
});

describe('bepaalModus', () => {
  it('respecteert expliciete modus', () => {
    expect(bepaalModus({ modus: 'sync' })).toBe('sync');
    expect(bepaalModus({ modus: 'backfill' })).toBe('backfill');
    expect(bepaalModus({ modus: 'test' })).toBe('test');
    expect(bepaalModus({ modus: 'handmatig' })).toBe('handmatig');
  });
  it('valt terug op test bij test_mode=true', () => {
    expect(bepaalModus({ test_mode: true })).toBe('test');
  });
  it('valt anders terug op handmatig', () => {
    expect(bepaalModus({})).toBe('handmatig');
    expect(bepaalModus({ modus: 'iets-anders' })).toBe('handmatig');
  });
});

describe('isoDatum', () => {
  it('formatteert als YYYY-MM-DD', () => {
    expect(isoDatum(new Date('2026-06-13T10:00:00Z'))).toBe('2026-06-13');
  });
});
