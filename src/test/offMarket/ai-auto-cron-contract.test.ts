import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822170500_activate_off_market_ai_auto_cron.sql'),
  'utf8',
);

describe('Off-Market AI auto-cron contract', () => {
  it('draait maximaal ieder kwartier via de auto-worker', () => {
    expect(migration).toContain("'off-market-ai-auto-quarter-hourly'");
    expect(migration).toContain("'*/15 * * * *'");
    expect(migration).toContain('/functions/v1/off-market-ai-auto-worker');
  });

  it('gebruikt alleen de server-side runtime secret', () => {
    expect(migration).toContain("where key='cron_secret'");
    expect(migration).not.toMatch(/sk-(?:proj-)?/i);
  });
});
