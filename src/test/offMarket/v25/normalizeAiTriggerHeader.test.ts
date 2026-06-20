// V2.5 — Statische controle dat normalize-ruw de x-cron-secret header meestuurt
// bij elke automatische AI-invoke, en dat invoke-fouten worden gelogd.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../../../../supabase/functions/off-market-normalize-ruw/index.ts'),
  'utf8',
);

describe('normalize-ruw — AI auto-trigger header', () => {
  it('stuurt x-cron-secret header mee bij invoke', () => {
    expect(SRC).toMatch(/headers:\s*\{\s*['"]x-cron-secret['"]\s*:\s*cronSecret\s*\}/);
  });

  it('slaat trigger over en logt fout als cron-secret ontbreekt', () => {
    expect(SRC).toMatch(/OFF_MARKET_CRON_SECRET ontbreekt/);
  });

  it('inspecteert { data, error } van invoke en logt fouten', () => {
    expect(SRC).toMatch(/AI auto-trigger invoke-fout/);
  });

  it('roept geen Kadaster of BAG aan', () => {
    expect(SRC).not.toMatch(/off-market-bag-verrijk/);
    expect(SRC).not.toMatch(/off-market-kadaster-check/);
    expect(SRC).not.toMatch(/kadaster-objectinformatie/);
  });
});

describe('enrich-signaal — cron-secret bypass', () => {
  const ENRICH = readFileSync(
    resolve(__dirname, '../../../../supabase/functions/off-market-enrich-signaal/index.ts'),
    'utf8',
  );

  it('accepteert geldig x-cron-secret zonder user-JWT', () => {
    expect(ENRICH).toMatch(/providedCron\s*===\s*cronSecret/);
    expect(ENRICH).toMatch(/if\s*\(!isCronCall\)\s*\{/);
  });

  it('vereist cronSecret aanwezig in env én exact match', () => {
    expect(ENRICH).toMatch(/!!cronSecret\s*&&\s*!!providedCron\s*&&\s*providedCron\s*===\s*cronSecret/);
  });

  it('JWT/intern-check blijft bestaan voor niet-cron calls', () => {
    expect(ENRICH).toMatch(/is_intern_gebruiker/);
    expect(ENRICH).toMatch(/getClaims/);
  });

  it('CORS staat x-cron-secret toe', () => {
    expect(ENRICH).toMatch(/Access-Control-Allow-Headers[^\n]*x-cron-secret/);
  });
});
