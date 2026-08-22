-- Gecontroleerde automatische AI-selectie voor Off-Market Radar.
-- Fail-closed: standaard uit. Geen BAG/Kadaster-cascade.

alter table public.off_market_ai_config
  add column if not exists auto_enrich_enabled boolean not null default false,
  add column if not exists auto_max_age_days integer not null default 30,
  add column if not exists auto_batch_size integer not null default 10;

alter table public.off_market_ai_config
  drop constraint if exists off_market_ai_config_auto_max_age_days_check;
alter table public.off_market_ai_config
  add constraint off_market_ai_config_auto_max_age_days_check
  check (auto_max_age_days between 1 and 90);

alter table public.off_market_ai_config
  drop constraint if exists off_market_ai_config_auto_batch_size_check;
alter table public.off_market_ai_config
  add constraint off_market_ai_config_auto_batch_size_check
  check (auto_batch_size between 1 and 25);

create or replace function public.off_market_ai_auto_candidates()
returns table (
  id uuid,
  bron_datum date,
  plaats text,
  titel text,
  prioriteit text,
  strategie text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.off_market_ai_config%rowtype;
begin
  select * into cfg from public.off_market_ai_config where id = true;
  if not found or not cfg.ai_enabled or not cfg.auto_enrich_enabled then
    return;
  end if;

  return query
  select
    s.id,
    s.bron_datum,
    s.plaats,
    s.titel,
    s.prioriteit::text,
    s.potentiele_strategie::text
  from public.off_market_signalen s
  where coalesce(s.ai_status::text, 'niet_verrijkt') = 'niet_verrijkt'
    and s.bron_datum >= (current_date - cfg.auto_max_age_days)
    and (
      s.potentiele_strategie::text = 'Splitsingspotentie'
      or lower(coalesce(s.titel, '')) ~ '(splitsingsvergunning|omzettingsvergunning|woonvormingsvergunning)'
      or s.prioriteit::text in ('hoog','midden')
    )
    and not (
      s.prioriteit::text = 'laag'
      and lower(coalesce(s.titel, '')) ~ '(houtopstand|kapvergunning|vellen van)'
    )
  order by
    case s.prioriteit::text when 'hoog' then 0 when 'midden' then 1 else 2 end,
    s.bron_datum desc nulls last,
    s.created_at desc
  limit cfg.auto_batch_size;
end;
$$;

revoke all on function public.off_market_ai_auto_candidates() from public, anon, authenticated;
grant execute on function public.off_market_ai_auto_candidates() to service_role;
