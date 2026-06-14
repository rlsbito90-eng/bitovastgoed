import { describe, it, expect } from 'vitest';
import {
  amsterdamParts, berekenVolgendeRun, isAanDeBeurt, selecteerBronnenVoorRun,
  type BronPlan,
} from '@/lib/offMarket/scheduler/planning';

function bron(over: Partial<BronPlan> = {}): BronPlan {
  return {
    id: 'b1', actief: true, auto_import: true, auto_verwerken: false,
    frequentie: 'dagelijks', dag_van_week: null, tijdstip_uur: 6,
    volgende_run_op: null, laatste_sync_op: null,
    ...over,
  };
}

describe('amsterdamParts', () => {
  it('mapt januari (CET, +01:00) correct', () => {
    const p = amsterdamParts(new Date('2026-01-15T05:00:00Z'));
    expect(p).toMatchObject({ year: 2026, month: 1, day: 15, hour: 6 });
  });
  it('mapt juli (CEST, +02:00) correct', () => {
    const p = amsterdamParts(new Date('2026-07-15T04:00:00Z'));
    expect(p).toMatchObject({ year: 2026, month: 7, day: 15, hour: 6 });
  });
});

describe('berekenVolgendeRun', () => {
  it('handmatig → null', () => {
    expect(berekenVolgendeRun(new Date('2026-06-13T08:00:00Z'), 'handmatig', 6, null)).toBeNull();
  });

  it('dagelijks: vóór tijdstip → vandaag', () => {
    // 2026-06-13 04:00 UTC = 06:00 Amsterdam (zomertijd)
    const now = new Date('2026-06-13T03:00:00Z'); // 05:00 Ams
    const next = berekenVolgendeRun(now, 'dagelijks', 6, null)!;
    expect(amsterdamParts(next)).toMatchObject({ year: 2026, month: 6, day: 13, hour: 6 });
  });

  it('dagelijks: na tijdstip → morgen', () => {
    const now = new Date('2026-06-13T10:00:00Z'); // 12:00 Ams
    const next = berekenVolgendeRun(now, 'dagelijks', 6, null)!;
    expect(amsterdamParts(next)).toMatchObject({ year: 2026, month: 6, day: 14, hour: 6 });
  });

  it('wekelijks: kiest juiste dag van de week', () => {
    // 2026-06-13 is een zaterdag (Ams). Doel: maandag (1).
    const now = new Date('2026-06-13T03:00:00Z'); // za 05:00
    const next = berekenVolgendeRun(now, 'wekelijks', 6, 1)!;
    expect(amsterdamParts(next)).toMatchObject({ year: 2026, month: 6, day: 15, hour: 6 });
    expect(amsterdamParts(next).weekday).toBe(1);
  });

  it('maandelijks: vóór de 28e in deze maand → 28e deze maand', () => {
    const now = new Date('2026-06-10T10:00:00Z');
    const next = berekenVolgendeRun(now, 'maandelijks', 6, null)!;
    expect(amsterdamParts(next)).toMatchObject({ year: 2026, month: 6, day: 28, hour: 6 });
  });

  it('maandelijks: na de 28e → 28e volgende maand', () => {
    const now = new Date('2026-06-29T10:00:00Z');
    const next = berekenVolgendeRun(now, 'maandelijks', 6, null)!;
    expect(amsterdamParts(next)).toMatchObject({ year: 2026, month: 7, day: 28, hour: 6 });
  });

  it('maandelijks: jaarwissel december → januari', () => {
    const now = new Date('2026-12-29T10:00:00Z');
    const next = berekenVolgendeRun(now, 'maandelijks', 6, null)!;
    expect(amsterdamParts(next)).toMatchObject({ year: 2027, month: 1, day: 28 });
  });
});

describe('isAanDeBeurt', () => {
  const now = new Date('2026-06-13T10:00:00Z');

  it('auto_import=false → niet', () => {
    expect(isAanDeBeurt(bron({ auto_import: false }), now)).toBe(false);
  });
  it('frequentie=handmatig → niet', () => {
    expect(isAanDeBeurt(bron({ frequentie: 'handmatig' }), now)).toBe(false);
  });
  it('actief=false → niet', () => {
    expect(isAanDeBeurt(bron({ actief: false }), now)).toBe(false);
  });
  it('volgende_run_op in verleden → wel', () => {
    expect(isAanDeBeurt(bron({ volgende_run_op: '2026-06-13T09:00:00Z' }), now)).toBe(true);
  });
  it('volgende_run_op in toekomst → niet', () => {
    expect(isAanDeBeurt(bron({ volgende_run_op: '2026-06-13T11:00:00Z' }), now)).toBe(false);
  });
  it('geen volgende_run_op → wel (eerste keer)', () => {
    expect(isAanDeBeurt(bron({ volgende_run_op: null }), now)).toBe(true);
  });
  it('maandelijks: volgende_run_op in verleden → wel', () => {
    expect(isAanDeBeurt(
      bron({ frequentie: 'maandelijks', volgende_run_op: '2026-05-28T04:00:00Z' }),
      now,
    )).toBe(true);
  });
  it('maandelijks: volgende_run_op in toekomst → niet', () => {
    expect(isAanDeBeurt(
      bron({ frequentie: 'maandelijks', volgende_run_op: '2026-06-28T04:00:00Z' }),
      now,
    )).toBe(false);
  });
});

describe('selecteerBronnenVoorRun', () => {
  const now = new Date('2026-06-13T10:00:00Z');

  it('filtert inactieve/handmatige/uitgeschakelde bronnen', () => {
    const lijst = [
      bron({ id: 'a', volgende_run_op: '2026-06-13T05:00:00Z' }),
      bron({ id: 'b', auto_import: false }),
      bron({ id: 'c', frequentie: 'handmatig' }),
      bron({ id: 'd', volgende_run_op: '2026-06-14T05:00:00Z' }),
    ];
    const r = selecteerBronnenVoorRun(lijst, now);
    expect(r.map(b => b.id)).toEqual(['a']);
  });

  it('sorteert op oudste volgende_run_op eerst', () => {
    const lijst = [
      bron({ id: 'b', volgende_run_op: '2026-06-13T05:00:00Z' }),
      bron({ id: 'a', volgende_run_op: '2026-06-13T03:00:00Z' }),
    ];
    const r = selecteerBronnenVoorRun(lijst, now);
    expect(r.map(b => b.id)).toEqual(['a', 'b']);
  });
});
