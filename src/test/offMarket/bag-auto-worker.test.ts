import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/off-market-bag-auto-worker/index.ts'),
  'utf8',
);

describe('Off-Market BAG auto worker', () => {
  it('pakt alleen nog niet verrijkte signalen met geldige GEO-basis', () => {
    expect(source).toContain(".eq('bag_status', 'niet_verrijkt')");
    expect(source).toContain(".eq('geo_status', 'verrijkt')");
    expect(source).toContain(".is('gearchiveerd_op', null)");
    expect(source).toContain(".not('adres', 'is', null)");
  });

  it('houdt de batch bewust begrensd', () => {
    expect(source).toContain('const batchLimit = 15');
    expect(source).toContain('.limit(batchLimit)');
  });

  it('roept uitsluitend de BAG resolver aan en nooit Kadaster of AI', () => {
    expect(source).toContain('/functions/v1/off-market-bag-verrijk');
    expect(source).not.toMatch(/kadaster-objectinformatie|kadaster-product|openai|anthropic|gemini|off-market-enrich-signaal/i);
  });

  it('vereist cron-secret auth met server-side fallback', () => {
    expect(source).toContain("Deno.env.get('OFF_MARKET_CRON_SECRET')");
    expect(source).toContain('off_market_runtime_secrets');
    expect(source).toContain(".eq('key', 'cron_secret')");
  });
});
