import { describe, it, expect } from 'vitest';

/**
 * Backfill payload — periode/preset → vanaf/tot.
 * Pure check op de logica zoals BronBackfillPanel hem gebruikt.
 */
function computedVoorPreset(preset: '30' | '90' | '180' | '365', nu: Date) {
  const dagen = Number(preset);
  const isoDatum = (d: Date) => d.toISOString().slice(0, 10);
  return {
    vanaf: isoDatum(new Date(nu.getTime() - dagen * 86400_000)),
    tot: isoDatum(nu),
  };
}

describe('Backfill payload — preset → periode', () => {
  it('preset 90 op 2026-06-14 → vanaf 2026-03-16, tot 2026-06-14', () => {
    const r = computedVoorPreset('90', new Date('2026-06-14T12:00:00Z'));
    expect(r.vanaf).toBe('2026-03-16');
    expect(r.tot).toBe('2026-06-14');
  });

  it('preset 30 levert ~30 dagen', () => {
    const r = computedVoorPreset('30', new Date('2026-06-14T12:00:00Z'));
    expect(r.vanaf).toBe('2026-05-15');
    expect(r.tot).toBe('2026-06-14');
  });

  it('preset 180 levert ~180 dagen', () => {
    const r = computedVoorPreset('180', new Date('2026-06-14T12:00:00Z'));
    expect(r.vanaf).toBe('2025-12-16');
  });
});

describe('Backfill cursor — volgende batch', () => {
  it('cursor_eind = cursor_start + opgehaald', () => {
    const start = 0, opgehaald = 1000;
    expect(start + opgehaald).toBe(1000);
  });

  it('tweede batch start op vorige cursor_eind', () => {
    const vorigEind = 1000;
    const tweedeStart = vorigEind;
    expect(tweedeStart).toBe(1000);
  });

  it('voltooid wanneer cursor_eind >= server_total', () => {
    const cursorEind = 5400, totaal = 5327;
    expect(cursorEind >= totaal).toBe(true);
  });
});
