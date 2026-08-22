import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822113200_off_market_ai_budget_controls.sql'),
  'utf8',
);
const guard = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/offMarketAiBudget.ts'),
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

  it('blokkeert op uitgeschakeld, daglimiet en maandlimiet', () => {
    expect(migration).toContain("'disabled'");
    expect(migration).toContain("'daily_request_limit'");
    expect(migration).toContain("'daily_cost_limit'");
    expect(migration).toContain("'monthly_cost_limit'");
    expect(guard).toContain("throw new AiBudgetError");
    expect(guard).toContain("status.allowed");
  });

  it('houdt de budget-RPC uitsluitend server-side uitvoerbaar', () => {
    expect(migration).toContain('revoke all on function public.off_market_ai_budget_status() from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.off_market_ai_budget_status() to service_role');
  });
});
