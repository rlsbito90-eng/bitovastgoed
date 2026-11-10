import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20261110003435_reduce_off_market_energy_bag_cron_polling.sql',
  ),
  'utf8',
);

describe('Supabase achtergrondjobs: efficiënte polling', () => {
  it('zet Off-Market-import, GEO en AI elk op maximaal eenmaal per uur', () => {
    for (const name of [
      'off-market-sync-quarter-hourly',
      'off-market-geo-quarter-hourly',
      'off-market-ai-auto-quarter-hourly',
    ]) {
      expect(migration).toContain(name);
    }
    expect(migration).toContain("'0 * * * *'");
    expect(migration).toContain("'10 * * * *'");
    expect(migration).toContain("'20 * * * *'");
  });

  it('zet BAG en energielabelverrijking op maximaal tweemaal per uur', () => {
    expect(migration).toContain('vastgoed-energy-auto-five-minutely');
    expect(migration).toContain('off-market-bag-auto-five-minutely');
    expect(migration).toContain("'5,35 * * * *'");
    expect(migration).toContain("'15,45 * * * *'");
  });

  it('past alleen de planning aan en verwijdert geen notificatie- of workerjobs', () => {
    expect(migration).toContain('cron.alter_job');
    expect(migration).not.toContain('cron.unschedule');
    expect(migration).not.toContain("('bito-notification-engine-1m'");
    expect(migration).not.toContain("('bito-notification-push-1m'");
  });
});
