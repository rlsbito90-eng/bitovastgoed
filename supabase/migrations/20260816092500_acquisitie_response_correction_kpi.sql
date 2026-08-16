-- TRACK-7D — data-quality hardening van responsmeting.
-- Append-only audit-events blijven intact; de meetlaag telt een brief niet als
-- reactie wanneer de laatste response_received-mutatie die respons verwijdert.

create or replace view public.acquisitie_tracking_events_v1
with (security_invoker = true)
as
with laatste_respons as (
  select distinct on (e.brief_id)
    e.brief_id,
    coalesce(e.respons_status, e.status) as laatste_respons_status
  from public.off_market_brief_events e
  where e.event_type = 'response_received'
    and e.brief_id is not null
  order by e.brief_id, e.event_date desc, e.created_at desc, e.id desc
),
brief_events as (
  select
    e.*,
    lr.laatste_respons_status,
    (
      e.event_type = 'response_received'
      and coalesce(lr.laatste_respons_status, '') not in ('geen_reactie', 'respons_verwijderd')
    ) as respons_is_actief
  from public.off_market_brief_events e
  left join laatste_respons lr on lr.brief_id = e.brief_id
)
select
  'brief_event'::text as bronlog,
  e.id::text as bron_event_id,
  case when e.vastgoedkans_id is not null then 'vastgoedkansen' when e.signaal_id is not null then 'off_market_radar' else 'overig' end::text as acquisitie_bron,
  e.event_date as occurred_at,
  case
    when e.event_type in ('posted','sent') then 'communicatie_verzonden'
    when e.event_type='response_received' and coalesce(e.respons_status,e.status)='respons_verwijderd' then 'reactie_verwijderd'
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
    when e.event_type='response_received' and not e.respons_is_actief then null
    when coalesce(e.respons_status,e.status) in ('interesse','wil_meer_informatie','gesprek_gepland') then 'positief'
    when coalesce(e.respons_status,e.status) in ('niet_geinteresseerd','verkocht_of_niet_relevant','afgevallen') then 'negatief'
    when e.event_type='response_received' and e.respons_is_actief and coalesce(e.respons_status,e.status) <> 'geen_reactie' then 'neutraal'
    else null
  end::text as sentiment,
  null::numeric as geraamde_kosten,
  null::numeric as werkelijke_kosten,
  null::text as valuta,
  false as telt_kadaster_aanvraag,
  false as telt_kadaster_levering,
  (e.event_type in ('posted','sent')) as telt_verzonden_communicatie,
  (e.event_type='response_received' and e.respons_is_actief and coalesce(e.respons_status,e.status) not in ('geen_reactie','respons_verwijderd')) as telt_reactie,
  (e.event_type='response_received' and e.respons_is_actief and coalesce(e.respons_status,e.status) in ('interesse','wil_meer_informatie','gesprek_gepland')) as telt_positieve_reactie,
  (e.event_type='returned_mail') as telt_retourpost,
  e.metadata
from brief_events e
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
