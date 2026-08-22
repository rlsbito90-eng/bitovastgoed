-- Schaalbare kandidatenselectie voor automatische energielabelverrijking.
-- Eén kandidaat per BAG-VBO, alleen exacte BAG-doelobjecten zonder verse snapshot.
-- Alleen service_role mag deze worker-RPC uitvoeren.

create or replace function public.vastgoed_energy_auto_candidates(
  _limit integer default 20
)
returns table (
  signaal_id uuid,
  bag_vbo_id text,
  bag_nummeraanduiding_id text,
  adres text,
  postcode text,
  plaats text
)
language sql
security definer
set search_path = public
as $$
  with cfg as (
    select greatest(1, energy_refresh_days) as refresh_days
    from public.vastgoed_intelligence_config
    where id = true
  ),
  ranked as (
    select distinct on (s.bag_geselecteerd_vbo_id)
      s.id as signaal_id,
      s.bag_geselecteerd_vbo_id as bag_vbo_id,
      s.bag_geselecteerd_nummeraanduiding_id as bag_nummeraanduiding_id,
      s.bag_geselecteerd_adres as adres,
      s.postcode,
      s.plaats,
      s.bag_verrijkt_op
    from public.off_market_signalen s
    cross join cfg
    where s.bag_status = 'verrijkt'
      and s.bag_match_kwaliteit = 'exact'
      and s.bag_geselecteerd_vbo_id ~ '^\d{16}$'
      and not exists (
        select 1
        from public.vastgoed_energielabel_snapshots e
        where e.bag_vbo_id = s.bag_geselecteerd_vbo_id
          and e.opgehaald_op >= now() - make_interval(days => cfg.refresh_days)
      )
    order by s.bag_geselecteerd_vbo_id, s.bag_verrijkt_op desc nulls last
  )
  select
    r.signaal_id,
    r.bag_vbo_id,
    r.bag_nummeraanduiding_id,
    r.adres,
    r.postcode,
    r.plaats
  from ranked r
  order by r.bag_verrijkt_op desc nulls last
  limit least(greatest(coalesce(_limit, 20), 1), 100);
$$;

revoke all on function public.vastgoed_energy_auto_candidates(integer) from public, anon, authenticated;
grant execute on function public.vastgoed_energy_auto_candidates(integer) to service_role;
