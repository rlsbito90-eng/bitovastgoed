-- TRACK-7C — data-quality hardening voor acquisitie-opvolging.
--
-- Probleem: off_market_brief_events is append-only en kan hetzelfde
-- follow-upfeit meermaals bevatten. De maand-KPI telde opvolging_aangemaakt
-- en opvolging_afgerond tot nu toe als ruwe events, terwijl verzendingen en
-- reacties al op een stabiele sleutel worden gededupliceerd.
--
-- Oplossing: tel follow-ups als unieke centrale taken. Nieuwe TRACK-7A
-- completion-events bevatten metadata.taak_id; voor oudere/afwijkende events
-- blijft een veilige fallback naar brief/event beschikbaar.

create or replace view public.acquisitie_tracking_kpis_maand_v1
with (security_invoker = true)
as
with basis as (
  select
    e.*,
    date_trunc('month', e.occurred_at)::date as maand,
    coalesce(e.brief_id::text, e.bronlog || ':' || e.bron_event_id) as communicatie_key,
    case
      when e.event_type in ('opvolging_aangemaakt','opvolging_afgerond') then
        coalesce(
          nullif(e.metadata->>'taak_id',''),
          e.brief_id::text,
          e.bronlog || ':' || e.bron_event_id
        )
      else null
    end as opvolging_key
  from public.acquisitie_tracking_events_v1 e
  where e.occurred_at is not null
),
per_bron as (
  select
    b.maand,
    b.acquisitie_bron,
    count(*) filter (where b.telt_kadaster_aanvraag) as kadaster_aanvragen,
    count(*) filter (where b.telt_kadaster_levering) as kadaster_leveringen,
    coalesce(sum(b.werkelijke_kosten) filter (where b.telt_kadaster_aanvraag),0)::numeric(12,2) as kadaster_werkelijke_kosten,
    coalesce(sum(coalesce(b.werkelijke_kosten,b.geraamde_kosten)) filter (where b.telt_kadaster_aanvraag),0)::numeric(12,2) as kadaster_kosten_beste_beschikbaar,
    count(distinct b.communicatie_key) filter (where b.telt_verzonden_communicatie) as verzonden_communicaties,
    count(distinct b.communicatie_key) filter (where b.telt_reactie) as reacties,
    count(distinct b.communicatie_key) filter (where b.telt_positieve_reactie) as positieve_reacties,
    count(distinct b.communicatie_key) filter (where b.telt_retourpost) as retourpost,
    count(distinct b.opvolging_key) filter (where b.event_type='opvolging_aangemaakt') as opvolging_aangemaakt,
    count(distinct b.opvolging_key) filter (where b.event_type='opvolging_afgerond') as opvolging_afgerond,
    count(distinct b.brief_id) filter (where b.event_type='brief_definitief_gemaakt') as definitieve_brieven,
    count(distinct b.batch_id) filter (where b.event_type='batch_geprint') as geprinte_batches
  from basis b
  group by b.maand,b.acquisitie_bron
)
select
  maand,
  acquisitie_bron,
  kadaster_aanvragen,
  kadaster_leveringen,
  kadaster_werkelijke_kosten,
  kadaster_kosten_beste_beschikbaar,
  verzonden_communicaties,
  reacties,
  positieve_reacties,
  retourpost,
  opvolging_aangemaakt,
  opvolging_afgerond,
  definitieve_brieven,
  geprinte_batches,
  case when verzonden_communicaties>0 then round((reacties::numeric/verzonden_communicaties)*100,1) else 0 end as responspercentage,
  case when verzonden_communicaties>0 then round((positieve_reacties::numeric/verzonden_communicaties)*100,1) else 0 end as positieve_responspercentage,
  case when reacties>0 then round((positieve_reacties::numeric/reacties)*100,1) else 0 end as positief_van_reacties_percentage,
  case when reacties>0 then round(kadaster_kosten_beste_beschikbaar/reacties,2) else null end as kadaster_kosten_per_reactie
from per_bron;

grant select on public.acquisitie_tracking_kpis_maand_v1 to authenticated;
