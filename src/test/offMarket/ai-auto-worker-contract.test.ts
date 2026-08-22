import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822163500_off_market_ai_auto_worker.sql'),
  'utf8',
);
const worker = readFileSync(
  resolve(process.cwd(), 'supabase/functions/off-market-ai-auto-worker/index.ts'),
  'utf8',
);

describe('Off-Market AI auto-worker contract', () => {
  it('start fail-closed en verwerkt kleine batches', () => {
    expect(migration).toContain('auto_enrich_enabled boolean not null default false');
    expect(migration).toContain('auto_max_age_days integer not null default 30');
    expect(migration).toContain('auto_batch_size integer not null default 10');
  });

  it('selecteert sterke herpositioneringssignalen en sluit kap uit', () => {
    expect(migration).toContain('Splitsingspotentie');
    expect(migration).toContain('splitsingsvergunning|omzettingsvergunning|woonvormingsvergunning');
    expect(migration).toContain('houtopstand|kapvergunning|vellen van');
  });

  it('candidate-RPC is uitsluitend service-role uitvoerbaar', () => {
    expect(migration).toContain('revoke all on function public.off_market_ai_auto_candidates() from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.off_market_ai_auto_candidates() to service_role');
  });

  it('worker gebruikt enrich-v2 sequentieel en stopt op budget/rate/auth', () => {
    expect(worker).toContain('off-market-enrich-signaal-v2');
    expect(worker).toContain('for (const row of rows');
    expect(worker).not.toContain('Promise.all(');
    expect(worker).toContain('response.status === 401 || response.status === 402 || response.status === 429');
  });

  it('worker start geen BAG- of Kadaster-cascade', () => {
    expect(worker).not.toContain('off-market-bag-verrijk');
    expect(worker.toLowerCase()).not.toContain('kadaster-objectinformatie');
  });
});
