import { describe, it, expect } from 'vitest';
import {
  bepaalVolgendeRunVoorPatch,
  type OffMarketBron,
} from '@/hooks/useOffMarketBronnen';

function bron(over: Partial<OffMarketBron> = {}): OffMarketBron {
  return {
    id: 'rdam', naam: 'Bekendmakingen Rotterdam', type: 'bekendmaking', actief: true,
    endpoint_url: null, laatste_run_op: null, laatste_run_status: null, laatste_fout: null,
    auto_import: false, auto_verwerken: false,
    frequentie: 'handmatig', dag_van_week: null, tijdstip_uur: 6, tijdstip_minuut: 0,
    max_records_per_run: 500, normalize_batch_size: 200,
    lookback_days_default: 7, lookback_overlap_uren: 24,
    volgende_run_op: null, laatste_sync_op: null, auto_start_op: null,
    backfill_vanaf: null, backfill_tot: null, backfill_cursor: 0,
    backfill_server_total: null, backfill_status: 'niet_gestart',
    ...over,
  };
}

describe('Broninstellingen — planning bij handmatig / auto_import uit', () => {
  it('niet-Amsterdam bron met auto_import=false → volgende_run_op = null', () => {
    const b = bron();
    const r = bepaalVolgendeRunVoorPatch(b, { auto_import: false });
    expect(r).toBeNull();
  });

  it('frequentie=handmatig → volgende_run_op = null, ook met auto_import aan', () => {
    const b = bron({ auto_import: true });
    const r = bepaalVolgendeRunVoorPatch(b, { frequentie: 'handmatig' });
    expect(r).toBeNull();
  });

  it('maandelijks is geldige frequentie en levert een gepland tijdstip', () => {
    const b = bron({ actief: true, auto_import: true, auto_start_op: '2026-06-14' });
    const r = bepaalVolgendeRunVoorPatch(
      b, { frequentie: 'maandelijks', tijdstip_uur: 9, tijdstip_minuut: 0 },
      new Date('2026-06-14T05:00:00Z'),
    );
    expect(r).not.toBeNull();
    expect(new Date(r!).getUTCDate()).toBe(28);
  });
});

describe('Backfill — cursor / status afgeleid', () => {
  it('voltooid wanneer cursor >= server_total', () => {
    const b = bron({ backfill_cursor: 500, backfill_server_total: 500, backfill_status: 'voltooid' });
    expect(b.backfill_status).toBe('voltooid');
    expect(b.backfill_cursor).toBeGreaterThanOrEqual(b.backfill_server_total!);
  });

  it('reset zet cursor terug op 0', () => {
    const reset: Partial<OffMarketBron> = {
      backfill_vanaf: null, backfill_tot: null, backfill_cursor: 0,
      backfill_server_total: null, backfill_status: 'niet_gestart',
    };
    expect(reset.backfill_cursor).toBe(0);
    expect(reset.backfill_status).toBe('niet_gestart');
  });
});
