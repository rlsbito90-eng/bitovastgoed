import { describe, it, expect } from 'vitest';
import { isStrongMatch, STRONG_MATCH_THRESHOLD } from '@/lib/derivations';

// Notificatietriggers — verifieert dat de centrale matching-drempel
// (70/100) wordt gebruikt voor sterke-match notificaties en dat oude
// 5-punts logica niet meer geldt.
describe('NotificationsBell — matching triggers', () => {
  it('gebruikt centrale STRONG_MATCH_THRESHOLD van 70', () => {
    expect(STRONG_MATCH_THRESHOLD).toBe(70);
  });

  it('score 69 geeft GEEN sterke match (geen notificatie)', () => {
    expect(isStrongMatch(69)).toBe(false);
  });

  it('score 70 geeft sterke match (notificatie mogelijk)', () => {
    expect(isStrongMatch(70)).toBe(true);
  });

  it('oude 5-punts drempel werkt niet meer als sterke match', () => {
    expect(isStrongMatch(5)).toBe(false);
  });
});

// Bod-verloop trigger — alleen vandaag (0) of morgen (1).
describe('NotificationsBell — bod-verloop venster', () => {
  function diffDagen(geldigTot: string, now: Date): number {
    const [y, m, d] = geldigTot.slice(0, 10).split('-').map(Number);
    const gt = new Date(y, m - 1, d);
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return Math.round((gt.getTime() - start.getTime()) / 86400000);
  }
  const now = new Date(2026, 5, 9); // 9 jun 2026

  it('vandaag triggert', () => {
    expect([0, 1]).toContain(diffDagen('2026-06-09', now));
  });
  it('morgen triggert', () => {
    expect([0, 1]).toContain(diffDagen('2026-06-10', now));
  });
  it('over 3 dagen triggert NIET', () => {
    expect([0, 1]).not.toContain(diffDagen('2026-06-12', now));
  });
  it('gisteren triggert NIET', () => {
    expect([0, 1]).not.toContain(diffDagen('2026-06-08', now));
  });
});
