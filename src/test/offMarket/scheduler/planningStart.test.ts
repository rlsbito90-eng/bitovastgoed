import { describe, it, expect } from 'vitest';
import {
  berekenVolgendeRunMetStart, amsterdamParts, amsterdamToday,
} from '@/lib/offMarket/scheduler/planning';
import { bepaalVolgendeRunVoorPatch } from '@/hooks/useOffMarketBronnen';
import type { OffMarketBron } from '@/hooks/useOffMarketBronnen';

function bron(over: Partial<OffMarketBron> = {}): OffMarketBron {
  return {
    id: 'b1', naam: 'Test', type: 'bekendmaking', actief: true,
    endpoint_url: null, laatste_run_op: null, laatste_run_status: null, laatste_fout: null,
    auto_import: true, auto_verwerken: false,
    frequentie: 'dagelijks', dag_van_week: null, tijdstip_uur: 9, tijdstip_minuut: 0,
    max_records_per_run: 500, normalize_batch_size: 200,
    lookback_days_default: 7, lookback_overlap_uren: 24,
    volgende_run_op: null, laatste_sync_op: null, auto_start_op: null,
    ...over,
  };
}

describe('berekenVolgendeRunMetStart — dagelijks', () => {
  it('start vandaag, tijdstip later vandaag → vandaag', () => {
    // 2026-06-15 04:00 UTC = 06:00 Ams (CEST). Tijdstip 9.
    const now = new Date('2026-06-15T04:00:00Z');
    const start = amsterdamToday(now);
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 9, null, start)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 15, hour: 9 });
  });

  it('start vandaag, tijdstip voorbij → morgen', () => {
    // 2026-06-15 10:00 UTC = 12:00 Ams. Tijdstip 9 al voorbij.
    const now = new Date('2026-06-15T10:00:00Z');
    const start = amsterdamToday(now);
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 9, null, start)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 16, hour: 9 });
  });

  it('startdatum in toekomst → die datum op gekozen uur', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 9, null, '2026-06-20')!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 20, hour: 9 });
  });

  it('start null = vandaag → zelfde gedrag als vandaag', () => {
    const now = new Date('2026-06-15T04:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'dagelijks', 9, null, null)!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 15, hour: 9 });
  });
});

describe('berekenVolgendeRunMetStart — wekelijks', () => {
  it('start vandaag, doel maandag → eerstvolgende maandag', () => {
    // 2026-06-13 = zaterdag (weekday 6). Doel maandag (1).
    const now = new Date('2026-06-13T03:00:00Z'); // za 05:00 Ams
    const r = berekenVolgendeRunMetStart(now, 'wekelijks', 9, 1, amsterdamToday(now))!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 15, hour: 9 });
  });

  it('doel = vandaag, uur al voorbij → volgende week', () => {
    // 2026-06-15 = maandag. 10:00 UTC = 12:00 Ams; uur 9 voorbij.
    const now = new Date('2026-06-15T10:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'wekelijks', 9, 1, amsterdamToday(now))!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 22, hour: 9 });
  });
});

describe('berekenVolgendeRunMetStart — maandelijks', () => {
  it('start vandaag vóór de 28e → 28e deze maand', () => {
    const now = new Date('2026-06-10T10:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'maandelijks', 9, null, amsterdamToday(now))!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 6, day: 28, hour: 9 });
  });

  it('start na de 28e → 28e volgende maand', () => {
    const now = new Date('2026-06-29T10:00:00Z');
    const r = berekenVolgendeRunMetStart(now, 'maandelijks', 9, null, amsterdamToday(now))!;
    expect(amsterdamParts(r)).toMatchObject({ year: 2026, month: 7, day: 28, hour: 9 });
  });

  it('handmatig → null', () => {
    expect(berekenVolgendeRunMetStart(new Date(), 'handmatig', 9, null, null)).toBeNull();
  });
});

describe('bepaalVolgendeRunVoorPatch', () => {
  const now = new Date('2026-06-15T04:00:00Z'); // 06:00 Ams maandag

  it('auto_import=false → null', () => {
    const b = bron({ auto_import: true });
    expect(bepaalVolgendeRunVoorPatch(b, { auto_import: false }, now)).toBeNull();
  });

  it('frequentie=handmatig → null', () => {
    const b = bron();
    expect(bepaalVolgendeRunVoorPatch(b, { frequentie: 'handmatig' }, now)).toBeNull();
  });

  it('actief=false → null', () => {
    const b = bron({ actief: false });
    expect(bepaalVolgendeRunVoorPatch(b, {}, now)).toBeNull();
  });

  it('dagelijks + vandaag + later uur → vandaag dat uur (ISO)', () => {
    const b = bron({ tijdstip_uur: 9, auto_start_op: amsterdamToday(now) });
    const iso = bepaalVolgendeRunVoorPatch(b, {}, now)!;
    expect(amsterdamParts(new Date(iso))).toMatchObject({ year: 2026, month: 6, day: 15, hour: 9 });
  });

  it('wijzigen tijdstip herberekent direct', () => {
    const b = bron({ tijdstip_uur: 9, auto_start_op: amsterdamToday(now) });
    const iso = bepaalVolgendeRunVoorPatch(b, { tijdstip_uur: 5 }, now)!;
    // 5 uur is voorbij om 06:00 Ams → morgen 05:00 Ams.
    expect(amsterdamParts(new Date(iso))).toMatchObject({ year: 2026, month: 6, day: 16, hour: 5 });
  });

  it('startdatum in toekomst herberekent', () => {
    const b = bron({ tijdstip_uur: 9, auto_start_op: amsterdamToday(now) });
    const iso = bepaalVolgendeRunVoorPatch(b, { auto_start_op: '2026-07-01' }, now)!;
    expect(amsterdamParts(new Date(iso))).toMatchObject({ year: 2026, month: 7, day: 1, hour: 9 });
  });
});
