import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/off-market-bag-bootstrap/index.ts'),
  'utf8',
);

describe('Off-Market BAG runtime auth bootstrap', () => {
  it('herstelt alleen de server-side cron secret wanneer Edge env ontbreekt', () => {
    expect(source).toContain("Deno.env.get('OFF_MARKET_CRON_SECRET')");
    expect(source).toContain("off_market_runtime_secrets");
    expect(source).toContain(".eq('key', 'cron_secret')");
    expect(source).toContain("Deno.env.set('OFF_MARKET_CRON_SECRET'");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it('importeert de BAG-businesslogica vanaf een vaste geverifieerde commit', () => {
    expect(source).toContain("e144b9da60e2b62c2291c01b3a4ffe53f0126e4f");
    expect(source).toContain("raw.githubusercontent.com/rlsbito90-eng/bitovastgoed");
    expect(source).toContain("supabase/functions/off-market-bag-verrijk/index.ts");
    expect(source).not.toContain('/main/');
  });

  it('bevat zelf geen betaalde Kadaster-, AI- of BAG-netwerkactie', () => {
    expect(source).not.toMatch(/kadaster-objectinformatie|kadaster-product|openai|anthropic|gemini/i);
    expect(source).not.toMatch(/api\.pdok\.nl|service\.pdok\.nl/i);
  });
});
