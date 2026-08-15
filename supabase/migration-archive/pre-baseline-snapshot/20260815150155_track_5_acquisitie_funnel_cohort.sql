-- TRACK-5 — responsfunnel als cohort op verzendmaand.
-- Reconcileert exact de op 15-08-2026 toegepaste productie-migratie.

create or replace view public.acquisitie_tracking_funnel_cohort_v1
with (security_invoker = true)
as
with verzending as (
  select
    brief_id,
    min(occurred_at) as eerste_verzending,
    min(acquisitie_bron) as acquisitie_bron
  from public.acquisitie_tracking_events_v1
  where telt_verzonden_communicatie
    and brief_id is not null
  group by brief_id
),
respons as (
  select
    brief_id,
    min(occurred_at) filter (where telt_reactie) as eerste_reactie,
    bool_or(telt_positieve_reactie) as positieve_reactie,
    bool_or(telt_retourpost) as retourpost
  from public.acquisitie_tracking_events_v1
  where brief_id is not null
  group by brief_id
),
cohort as (
  select
    date_trunc('month', v.eerste_verzending)::date as verzendmaand,
    v.acquisitie_bron,
    v.brief_id,
    v.eerste_verzending,
    r.eerste_reactie,
    coalesce(r.positieve_reactie,false) as positieve_reactie,
    coalesce(r.retourpost,false) as retourpost,
    case when r.eerste_reactie is not null then extract(epoch from (r.eerste_reactie-v.eerste_verzending))/86400.0 else null end as dagen_tot_reactie
  from verzending v
  left join respons r on r.brief_id=v.brief_id
)
select
  verzendmaand,
  acquisitie_bron,
  count(*) as verzonden_brieven,
  count(*) filter (where eerste_reactie is not null) as reacties,
  count(*) filter (where positieve_reactie) as positieve_reacties,
  count(*) filter (where retourpost) as retourpost,
  round(100.0*count(*) filter (where eerste_reactie is not null)/nullif(count(*),0),1) as responspercentage,
  round(100.0*count(*) filter (where positieve_reactie)/nullif(count(*),0),1) as positieve_responspercentage,
  round(avg(dagen_tot_reactie) filter (where dagen_tot_reactie is not null),1) as gemiddelde_dagen_tot_reactie
from cohort
group by verzendmaand,acquisitie_bron;

grant select on public.acquisitie_tracking_funnel_cohort_v1 to authenticated;
