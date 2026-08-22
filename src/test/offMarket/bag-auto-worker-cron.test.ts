import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260823003500_activate_off_market_bag_auto_worker.sql'),
  'utf8',
);

describe('BAG auto-worker cron', () => {
  it('draait iedere vijf minuten via de productie Edge Function', () => {
    expect(migration).toContain("'off-market-bag-auto-five-minutely'");
    expect(migration).toContain("'*/5 * * * *'");
    expect(migration).toContain('/functions/v1/off-market-bag-auto-worker');
  });

  it('geeft de sequentiele BAG-batch voldoende pg_net tijd', () => {
    expect(migration).toContain('timeout_milliseconds := 120000');
  });

  it('gebruikt alleen de server-side cron secret', () => {
    const lower = migration.toLowerCase();
    expect(lower).toContain('off_market_runtime_secrets');
    expect(lower).toContain("where key = 'cron_secret'");
    expect(migration).not.toMatch(/kadaster-objectinformatie|openai|anthropic|gemini/i);
  });
});
