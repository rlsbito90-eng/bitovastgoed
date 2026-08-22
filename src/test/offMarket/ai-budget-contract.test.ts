import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822113200_off_market_ai_budget_controls.sql'),
  'utf8',
);
const hardening = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822161000_harden_off_market_ai_budget_and_pricing.sql'),
  'utf8',
);
const guard = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/offMarketAiBudget.ts'),
  'utf8',
);
const enrich = readFileSync(
  resolve(process.cwd(), 'supabase/functions/off-market-enrich-signaal-v2/index.ts'),
  'utf8',
);

describe('Off-Market AI budgetcontract', () => {
  it('start fail-closed met AI uit en conservatieve limieten', () => {
    expect(migration).toContain("ai_enabled boolean not null default false");
    expect(migration).toContain("provider text not null default 'openai'");
    expect(migration).toContain('max_requests_per_day integer not null default 50');
    expect(migration).toContain('max_cost_per_day_usd numeric(12,6) not null default 1.00');
    expect(migration).toContain('max_cost_per_month_usd numeric(12,6) not null default 5.00');
  });

  it('blokkeert op uitgeschakeld, prijsconfig, daglimiet en maandlimiet', () => {
    expect(migration).toContain("'disabled'");
    expect(hardening).toContain("'pricing_missing'");
    expect(hardening).toContain("'daily_request_limit'");
    expect(hardening).toContain("'daily_cost_limit'");
    expect(hardening).toContain("'monthly_cost_limit'");
    expect(guard).toContain("throw new AiBudgetError");
    expect(guard).toContain("status.allowed");
  });

  it('telt echte providerpogingen en gebruikt Amsterdamse budgetgrenzen', () => {
    expect(hardening).toContain("time zone 'Europe/Amsterdam'");
    expect(hardening).toContain('provider_request_id is not null or coalesce(succes,false) = false');
    expect(hardening).toContain('max_cost_per_request_usd');
  });

  it('koppelt kosten aan het geconfigureerde model en tarief', () => {
    expect(hardening).toContain("pricing_model = 'gpt-5.6-luna'");
    expect(hardening).toContain('input_usd_per_million = 0.200000');
    expect(hardening).toContain('output_usd_per_million = 1.200000');
    expect(enrich).toContain("throw new AiBudgetError('pricing_missing'");
    expect(enrich).toContain('budget.input_usd_per_million');
    expect(enrich).toContain('budget.output_usd_per_million');
  });

  it('houdt de budget-RPC uitsluitend server-side uitvoerbaar', () => {
    expect(hardening).toContain('revoke all on function public.off_market_ai_budget_status() from public, anon, authenticated');
    expect(hardening).toContain('grant execute on function public.off_market_ai_budget_status() to service_role');
  });
});
