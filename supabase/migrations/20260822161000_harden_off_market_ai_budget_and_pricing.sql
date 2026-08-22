alter table public.off_market_ai_runs
  alter column kosten type numeric(12,6) using kosten::numeric(12,6);

alter table public.off_market_ai_config
  add column if not exists pricing_model text,
  add column if not exists input_usd_per_million numeric(12,6),
  add column if not exists output_usd_per_million numeric(12,6),
  add column if not exists max_cost_per_request_usd numeric(12,6) not null default 0.010000;

update public.off_market_ai_config
set pricing_model = 'gpt-5.6-luna',
    input_usd_per_million = 0.200000,
    output_usd_per_million = 1.200000,
    max_cost_per_request_usd = 0.010000,
    updated_at = now()
where id = true and provider = 'openai' and default_model = 'gpt-5.6-luna';

create or replace function public.off_market_ai_budget_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  cfg public.off_market_ai_config%rowtype;
  day_start timestamptz;
  month_start timestamptz;
  day_requests integer := 0;
  day_cost numeric := 0;
  month_cost numeric := 0;
  reserve numeric := 0;
  allowed boolean := false;
begin
  select * into cfg from public.off_market_ai_config where id = true;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'config_missing');
  end if;

  day_start := (date_trunc('day', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam');
  month_start := (date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam');
  reserve := coalesce(cfg.max_cost_per_request_usd, 0);

  select count(*) into day_requests
  from public.off_market_ai_runs
  where run_op >= day_start
    and provider is not null
    and (provider_request_id is not null or coalesce(succes,false) = false);

  select coalesce(sum(kosten),0) into day_cost
  from public.off_market_ai_runs
  where run_op >= day_start
    and coalesce(succes,false) = true
    and kosten is not null;

  select coalesce(sum(kosten),0) into month_cost
  from public.off_market_ai_runs
  where run_op >= month_start
    and coalesce(succes,false) = true
    and kosten is not null;

  allowed := cfg.ai_enabled
    and cfg.pricing_model is not null
    and cfg.input_usd_per_million is not null and cfg.input_usd_per_million > 0
    and cfg.output_usd_per_million is not null and cfg.output_usd_per_million > 0
    and day_requests < cfg.max_requests_per_day
    and (day_cost + reserve) <= cfg.max_cost_per_day_usd
    and (month_cost + reserve) <= cfg.max_cost_per_month_usd;

  return jsonb_build_object(
    'allowed', allowed,
    'ai_enabled', cfg.ai_enabled,
    'provider', cfg.provider,
    'default_model', cfg.default_model,
    'pricing_model', cfg.pricing_model,
    'input_usd_per_million', cfg.input_usd_per_million,
    'output_usd_per_million', cfg.output_usd_per_million,
    'max_cost_per_request_usd', cfg.max_cost_per_request_usd,
    'day_requests', day_requests,
    'day_cost_usd', day_cost,
    'month_cost_usd', month_cost,
    'max_requests_per_day', cfg.max_requests_per_day,
    'max_cost_per_day_usd', cfg.max_cost_per_day_usd,
    'max_cost_per_month_usd', cfg.max_cost_per_month_usd,
    'reason', case
      when not cfg.ai_enabled then 'disabled'
      when cfg.pricing_model is null or cfg.input_usd_per_million is null or cfg.input_usd_per_million <= 0 or cfg.output_usd_per_million is null or cfg.output_usd_per_million <= 0 then 'pricing_missing'
      when day_requests >= cfg.max_requests_per_day then 'daily_request_limit'
      when (day_cost + reserve) > cfg.max_cost_per_day_usd then 'daily_cost_limit'
      when (month_cost + reserve) > cfg.max_cost_per_month_usd then 'monthly_cost_limit'
      else null
    end
  );
end;
$function$;

revoke all on function public.off_market_ai_budget_status() from public, anon, authenticated;
grant execute on function public.off_market_ai_budget_status() to service_role;

update public.off_market_ai_runs
set kosten = round(((coalesce(input_tokens,0)::numeric / 1000000) * 0.20 + (coalesce(output_tokens,0)::numeric / 1000000) * 1.20), 6)
where id = '24bbf08b-212e-4f72-a299-a57a583e197f'
  and provider = 'openai'
  and model = 'gpt-5.6-luna'
  and succes = true;
