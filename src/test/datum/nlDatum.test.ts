// Fase 1.1 — Nederlandse werkdag rond UTC-daggrens.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getNlDatum, vandaagNl, isDatumInToekomstNl } from '@/lib/datum/nlDatum';

afterEach(() => { vi.useRealTimers(); });

describe('nlDatum', () => {
  it('UTC 22:30 op 21 juli 2026 is in Amsterdam 22 juli 2026 (zomertijd)', () => {
    // UTC = 2026-07-21T22:30:00Z; Amsterdam +02:00 → 2026-07-22 00:30.
    expect(getNlDatum(new Date('2026-07-21T22:30:00Z'))).toBe('2026-07-22');
  });

  it('UTC 22:30 op 31 december 2026 is in Amsterdam 31 december 2026 (wintertijd, +01:00)', () => {
    expect(getNlDatum(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31');
  });

  it('vandaagNl gebruikt Europe/Amsterdam', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T22:45:00Z'));
    expect(vandaagNl()).toBe('2026-07-22');
  });

  it('isDatumInToekomstNl vergelijkt lexicografisch YYYY-MM-DD', () => {
    expect(isDatumInToekomstNl('2026-07-23', '2026-07-22')).toBe(true);
    expect(isDatumInToekomstNl('2026-07-22', '2026-07-22')).toBe(false);
    expect(isDatumInToekomstNl('2026-07-21', '2026-07-22')).toBe(false);
  });
});
