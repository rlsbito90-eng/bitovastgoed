import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const runtime = fs.readFileSync(
  path.join(root, 'supabase/functions/off-market-normalize-runtime/index.ts'),
  'utf8',
);
const triggerHelper = fs.readFileSync(
  path.join(root, 'supabase/functions/_shared/offMarketAutoTrigger.ts'),
  'utf8',
);
const placeMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260823010000_guard_off_market_place_noise.sql'),
  'utf8',
);

describe('Off-Market normalizer production parity', () => {
  it('hydrateert cron-auth alleen server-side en importeert lokaal', () => {
    expect(runtime).toContain("Deno.env.get('OFF_MARKET_CRON_SECRET')");
    expect(runtime).toContain('off_market_runtime_secrets');
    expect(runtime).toContain(".eq('key', 'cron_secret')");
    expect(runtime).toContain("await import('../off-market-normalize-ruw/index.ts')");
    expect(runtime).not.toMatch(/raw\.githubusercontent\.com/);
  });

  it('schakelt directe normalizer-AI uit ten gunste van de dedicated worker', () => {
    expect(triggerHelper).toContain('AI_TRIGGER_CAP_PER_RUN = 0');
  });

  it('guardt alleen bewezen plaatsruis en gebruikt bron-gemeente als fallback', () => {
    for (const token of ['vormen', 'omzetten', 'bouwkundig', 'splitsing']) {
      expect(placeMigration.toLowerCase()).toContain(token);
    }
    expect(placeMigration).toMatch(/\^Z20/);
    expect(placeMigration).toContain("config->>'gemeente'");
    expect(placeMigration).not.toMatch(/udenhout|hoek|dieren/i);
  });

  it('voegt geen automatische Kadasteractie toe', () => {
    expect(runtime).not.toMatch(/kadaster-objectinformatie|api\.kadaster\.nl/i);
    expect(placeMigration).not.toMatch(/kadaster-objectinformatie|api\.kadaster\.nl/i);
  });
});
