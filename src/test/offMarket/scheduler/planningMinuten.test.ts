import { describe, it, expect } from 'vitest';
import {
  berekenVolgendeRunMetStart, amsterdamParts, amsterdamToday,
  normaliseerMinuut, TOEGESTANE_MINUTEN,
} from '@/lib/offMarket/scheduler/planning';

describe('normaliseerMinuut', () => {
  it('accepteert alleen 0/15/30/45', () => {
    expect(TOEGESTANE_MINUTEN).toEqual([0, 15, 30, 45]);
    for (const m of TOEGESTANE_MINUTEN) expect(normaliseerMinuut(m)).toBe(m);
  });
  it('valt terug op 0 bij ongeldige waarde', () => {
    expect(normaliseerMinuut(7)).toBe(0);
    expect(normaliseerMinuut(60)).toBe(0);
    expect(normaliseerMinuut(null)).toBe(0);
    expect(normaliseerMinuut('foo')).toBe(0);
  });
});

describe('planning met minuten — dagelijks', () => {
  it('vandaag 15:15 terwijl nu 15:01 (Ams) → vandaag 15:15', () => {
    // 13:01 UTC = 15:01 Ams (CEST).
    const now = new Date('2026-06-14T13:01:00Z');
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 15, null, amsterdamToday(now), 15)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 14, hour: 15, minute: 15 });
  });

  it('vandaag 15:15 terwijl nu 15:16 (Ams) → morgen 15:15', () => {
    const now = new Date('2026-06-14T13:16:00Z');
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 15, null, amsterdamToday(now), 15)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 15, hour: 15, minute: 15 });
  });

  it('vandaag exact 15:15 (Ams) → morgen 15:15 (gelijk = voorbij)', () => {
    const now = new Date('2026-06-14T13:15:00Z');
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 15, null, amsterdamToday(now), 15)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 15, hour: 15, minute: 15 });
  });
});

describe('planning met minuten — wekelijks', () => {
  it('doel maandag 09:30, start za → eerstvolgende ma 09:30', () => {
    const now = new Date('2026-06-13T03:00:00Z'); // za 05:00 Ams
    const r = berekenVolgendeRunMetStart(now, 'wekelijks', 9, 1, amsterdamToday(now), 30)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 15, hour: 9, minute: 30 });
  });

  it('doel = vandaag (ma) 09:30, nu 12:00 Ams → volgende week ma 09:30', () => {
    const now = new Date('2026-06-15T10:00:00Z'); // ma 12:00 Ams
    const r = berekenVolgendeRunMetStart(now, 'wekelijks', 9, 1, amsterdamToday(now), 30)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 22, hour: 9, minute: 30 });
  });
});

describe('planning met minuten — maandelijks', () => {
  it('28e 06:45 deze maand als nog niet voorbij', () => {
    const now = new Date('2026-06-10T10:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'maandelijks', 6, null, amsterdamToday(now), 45)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 28, hour: 6, minute: 45 });
  });

  it('28e voorbij → volgende maand 28e 06:45', () => {
    const now = new Date('2026-06-29T10:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'maandelijks', 6, null, amsterdamToday(now), 45)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 7, day: 28, hour: 6, minute: 45 });
  });
});

describe('timezone — UTC ↔ Amsterdam consistentie', () => {
  it('15:15 Ams in zomertijd = 13:15 UTC', () => {
    const now = new Date('2026-06-14T13:01:00Z');
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 15, null, amsterdamToday(now), 15)!;
    expect(r.toISOString()).toBe('2026-06-14T13:15:00.000Z');
  });

  it('06:00 Ams in wintertijd = 05:00 UTC', () => {
    const now = new Date('2026-01-14T00:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 6, null, amsterdamToday(now), 0)!;
    expect(r.toISOString()).toBe('2026-01-14T05:00:00.000Z');
  });
});
