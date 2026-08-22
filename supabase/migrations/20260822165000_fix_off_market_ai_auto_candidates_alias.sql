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
  select c.* into cfg
  from public.off_market_ai_config c
  where c.id = true;

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
