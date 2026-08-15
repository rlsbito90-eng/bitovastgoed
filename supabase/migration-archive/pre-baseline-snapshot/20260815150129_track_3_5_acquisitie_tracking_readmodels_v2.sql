-- TRACK-3/5 — centrale acquisitie-meetlaag boven bestaande bronlogs.
-- Reconcileert exact de op 15-08-2026 toegepaste productie-migratie.

 grant select on table public.off_market_productie_events to authenticated;
alter table public.off_market_productie_events enable row level security;
drop policy if exists acquisitie_tracking_productie_events_intern_lezen on public.off_market_productie_events;
create policy acquisitie_tracking_productie_events_intern_lezen
  on public.off_market_productie_events
  for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

create or replace view public.acquisitie_tracking_events_v1
with (security_invoker = true)
as
select
  'brief_event'::text as bronlog,
  e.id::text as bron_event_id,
  case when e.vastgoedkans_id is not null then 'vastgoedkansen' when e.signaal_id is not null then 'off_market_radar' else 'overig' end::text as acquisitie_bron,
  e.event_date as occurred_at,
  case
    when e.event_type in ('posted','sent') then 'communicatie_verzonden'
    when e.event_type='response_received' and coalesce(e.respons_status,e.status) <> 'geen_reactie' then 'reactie_ontvangen'
    when e.event_type='returned_mail' then 'post_retour'
    when e.event_type='follow_up_created' then 'opvolging_aangemaakt'
    when e.event_type='follow_up_completed' then 'opvolging_afgerond'
    when e.event_type='printed' then 'brief_geprint'
    when e.event_type='pdf_generated' then 'brief_pdf_gegenereerd'
    when e.event_type='concept_created' then 'brief_concept_aangemaakt'
    when e.event_type='email_text_copied' then 'emailtekst_gekopieerd'
    when e.event_type='archived' then 'dossier_gearchiveerd'
    else e.event_type
  end::text as event_type,
  e.vastgoedkans_id,
  e.signaal_id,
  e.brief_id,
  null::uuid as brief_versie_id,
  null::uuid as batch_id,
  e.created_by as actor_id,
  e.kanaal,
  coalesce(e.respons_status,e.status) as status,
  case
    when coalesce(e.respons_status,e.status) in ('interesse','wil_meer_informatie','gesprek_gepland') then 'positief'
    when coalesce(e.respons_status,e.status) in ('niet_geinteresseerd','verkocht_of_niet_relevant','afgevallen') then 'negatief'
    when e.event_type='response_received' and coalesce(e.respons_status,e.status) <> 'geen_reactie' then 'neutraal'
    else null
  end::text as sentiment,
  null::numeric as geraamde_kosten,
  null::numeric as werkelijke_kosten,
  null::text as valuta,
  false as telt_kadaster_aanvraag,
  false as telt_kadaster_levering,
  (e.event_type in ('posted','sent')) as telt_verzonden_communicatie,
  (e.event_type='response_received' and coalesce(e.respons_status,e.status) <> 'geen_reactie') as telt_reactie,
  (coalesce(e.respons_status,e.status) in ('interesse','wil_meer_informatie','gesprek_gepland')) as telt_positieve_reactie,
  (e.event_type='returned_mail') as telt_retourpost,
  e.metadata
from public.off_market_brief_events e
where (e.vastgoedkans_id is not null) <> (e.signaal_id is not null)

union all

select
  'kadaster_kosten'::text,
  k.id::text,
  case when k.bron_module='vastgoedkansen' then 'vastgoedkansen' when k.bron_module='off_market_radar' then 'off_market_radar' else 'overig' end,
  coalesce(k.geleverd_op,k.aangevraagd_op),
  case
    when k.status in ('geleverd','gedeeltelijk_geleverd') then 'kadaster_geleverd'
    when k.status in ('mislukt','geannuleerd') then 'kadaster_mislukt'
    when k.status in ('geraamd','bevestigd') then 'kadaster_aangevraagd'
    when k.status='hergebruikt' then 'kadaster_hergebruikt'
    else 'kadaster_overig'
  end,
  k.vastgoedkans_id,
  null::uuid,
  null::uuid,
  null::uuid,
  null::uuid,
  k.gebruiker_id,
  null::text,
  k.status,
  null::text,
  k.geraamde_kosten,
  k.werkelijke_kosten,
  k.valuta,
  (k.status <> 'hergebruikt'),
  (k.status in ('geleverd','gedeeltelijk_geleverd')),
  false,
  false,
  false,
  false,
  k.metadata
from public.kadaster_kosten_events k

union all

select
  'productiekern'::text,
  p.id::text,
  'off_market_radar'::text,
  p.event_at,
  case when p.event_type='briefnummer_uitgegeven' then 'brief_definitief_gemaakt' when p.event_type='batch_geprint' then 'batch_geprint' when p.event_type='brief_gepost' then 'communicatie_verzonden' else p.event_type end,
  null::uuid,
  p.signaal_id,
  p.brief_id,
  p.brief_versie_id,
  p.batch_id,
  p.actor_id,
  case when p.event_type='brief_gepost' then 'post' else null end::text,
  null::text,
  null::text,
  null::numeric,
  null::numeric,
  null::text,
  false,
  false,
  (p.event_type='brief_gepost'),
  false,
  false,
  false,
  p.metadata
from public.off_market_productie_events p;

grant select on public.acquisitie_tracking_events_v1 to authenticated;

create or replace view public.acquisitie_tracking_kpis_maand_v1
with (security_invoker = true)
as
with basis as (
  select
    e.*,
    date_trunc('month', e.occurred_at)::date as maand,
    coalesce(e.brief_id::text, e.bronlog || ':' || e.bron_event_id) as communicatie_key
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
    count(*) filter (where b.event_type='opvolging_aangemaakt') as opvolging_aangemaakt,
    count(*) filter (where b.event_type='opvolging_afgerond') as opvolging_afgerond,
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
