alter table public.off_market_ai_runs
  add column if not exists provider text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists provider_request_id text;

create table if not exists public.off_market_ai_config (
  id boolean primary key default true check (id = true),
  ai_enabled boolean not null default false,
  provider text not null default 'openai' check (provider in ('openai','anthropic','gemini')),
  default_model text,
  max_requests_per_day integer not null default 50 check (max_requests_per_day >= 0),
  max_cost_per_day_usd numeric(12,6) not null default 1.00 check (max_cost_per_day_usd >= 0),
  max_cost_per_month_usd numeric(12,6) not null default 5.00 check (max_cost_per_month_usd >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.off_market_ai_config (id, ai_enabled, provider, max_requests_per_day, max_cost_per_day_usd, max_cost_per_month_usd)
values (true, false, 'openai', 50, 1.00, 5.00)
on conflict (id) do nothing;

alter table public.off_market_ai_config enable row level security;

revoke all on table public.off_market_ai_config from anon;
revoke all on table public.off_market_ai_config from authenticated;
grant select, update on table public.off_market_ai_config to authenticated;
grant all on table public.off_market_ai_config to service_role;

drop policy if exists off_market_ai_config_intern_select on public.off_market_ai_config;
create policy off_market_ai_config_intern_select
on public.off_market_ai_config for select to authenticated
using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists off_market_ai_config_intern_update on public.off_market_ai_config;
create policy off_market_ai_config_intern_update
on public.off_market_ai_config for update to authenticated
using (public.is_intern_gebruiker(auth.uid()))
with check (public.is_intern_gebruiker(auth.uid()));

create or replace function public.off_market_ai_budget_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.off_market_ai_config%rowtype;
  day_requests integer := 0;
  day_cost numeric := 0;
  month_cost numeric := 0;
  allowed boolean := false;
begin
  select * into cfg from public.off_market_ai_config where id = true;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'config_missing');
  end if;

  select count(*), coalesce(sum(kosten),0)
    into day_requests, day_cost
  from public.off_market_ai_runs
  where run_op >= date_trunc('day', now())
    and coalesce(succes,false) = true
    and coalesce(kosten,0) > 0;

  select coalesce(sum(kosten),0)
    into month_cost
  from public.off_market_ai_runs
  where run_op >= date_trunc('month', now())
    and coalesce(succes,false) = true
    and coalesce(kosten,0) > 0;

  allowed := cfg.ai_enabled
    and day_requests < cfg.max_requests_per_day
    and day_cost < cfg.max_cost_per_day_usd
    and month_cost < cfg.max_cost_per_month_usd;

  return jsonb_build_object(
    'allowed', allowed,
    'ai_enabled', cfg.ai_enabled,
    'provider', cfg.provider,
    'default_model', cfg.default_model,
    'day_requests', day_requests,
    'day_cost_usd', day_cost,
    'month_cost_usd', month_cost,
    'max_requests_per_day', cfg.max_requests_per_day,
    'max_cost_per_day_usd', cfg.max_cost_per_day_usd,
    'max_cost_per_month_usd', cfg.max_cost_per_month_usd,
    'reason', case
      when not cfg.ai_enabled then 'disabled'
      when day_requests >= cfg.max_requests_per_day then 'daily_request_limit'
      when day_cost >= cfg.max_cost_per_day_usd then 'daily_cost_limit'
      when month_cost >= cfg.max_cost_per_month_usd then 'monthly_cost_limit'
      else null
    end
  );
end;
$$;

revoke all on function public.off_market_ai_budget_status() from public, anon, authenticated;
grant execute on function public.off_market_ai_budget_status() to service_role;
