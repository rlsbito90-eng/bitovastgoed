-- TRACK-7D — correctiebewuste responsmeting.
--
-- Probleem:
-- `off_market_brief_events` is append-only. Wanneer een eerder geregistreerde
-- respons wordt verwijderd blijft het oorspronkelijke `response_received`-event
-- terecht bestaan, maar de meetlaag telde die respons daardoor alsnog mee.
-- Ook latere wijzigingen aan dezelfde respons konden in een andere maand nog
-- een extra meetmoment opleveren.
--
-- Oplossing:
-- - behoud alle audit-events;
-- - gebruik de huidige responsstatus op `off_market_brieven` als gecorrigeerde
--   waarheid;
-- - kies maximaal één canoniek response-event per actieve responssegment;
-- - een `respons_verwijderd`-correctie beëindigt het vorige segment;
-- - retourpost wordt op dezelfde manier correctiebewust behandeld;
-- - bestaande kolommen/types van `acquisitie_tracking_events_v1` blijven gelijk,
--   zodat de afhankelijke maand-KPI en funnel automatisch dezelfde correctie zien.

create or replace view public.acquisitie_tracking_events_v1
with (security_invoker = true)
as
with brief_event_basis as (
  select
    e.*,
    b.responsstatus as actuele_responsstatus,
    b.verzendstatus as actuele_verzendstatus,
    max(e.event_date) filter (
      where e.event_type = 'response_received'
        and e.status = 'respons_verwijderd'
    ) over (partition by e.brief_id) as laatste_respons_verwijderd_op
  from public.off_market_brief_events e
  left join public.off_market_brieven b on b.id = e.brief_id
),
brief_events as (
  select
    e.*,
    min(e.event_date) filter (
      where e.event_type = 'response_received'
        and coalesce(e.status, '') <> 'respons_verwijderd'
        and (
          e.laatste_respons_verwijderd_op is null
          or e.event_date > e.laatste_respons_verwijderd_op
        )
    ) over (partition by e.brief_id) as canonieke_respons_event_op,
    min(e.event_date) filter (
      where e.event_type = 'returned_mail'
        and (
          e.laatste_respons_verwijderd_op is null
          or e.event_date > e.laatste_respons_verwijderd_op
        )
    ) over (partition by e.brief_id) as canonieke_retour_event_op
  from brief_event_basis e
)
select
  'brief_event'::text as bronlog,
  e.id::text as bron_event_id,
  case
    when e.vastgoedkans_id is not null then 'vastgoedkansen'
    when e.signaal_id is not null then 'off_market_radar'
    else 'overig'
  end::text as acquisitie_bron,
  e.event_date as occurred_at,
  case
    when e.event_type in ('posted','sent') then 'communicatie_verzonden'
    when e.event_type = 'response_received' and e.status = 'respons_verwijderd' then 'reactie_verwijderd'
    when e.event_type = 'response_received'
      and e.event_date = e.canonieke_respons_event_op
      and e.actuele_responsstatus is not null
      and e.actuele_responsstatus not in ('geen_reactie','retour_post')
      then 'reactie_ontvangen'
    when e.event_type = 'response_received' then 'reactie_gecorrigeerd'
    when e.event_type = 'returned_mail' then 'post_retour'
    when e.event_type = 'follow_up_created' then 'opvolging_aangemaakt'
    when e.event_type = 'follow_up_completed' then 'opvolging_afgerond'
    when e.event_type = 'printed' then 'brief_geprint'
    when e.event_type = 'pdf_generated' then 'brief_pdf_gegenereerd'
    when e.event_type = 'concept_created' then 'brief_concept_aangemaakt'
    when e.event_type = 'email_text_copied' then 'emailtekst_gekopieerd'
    when e.event_type = 'archived' then 'dossier_gearchiveerd'
    else e.event_type
  end::text as event_type,
  e.vastgoedkans_id,
  e.signaal_id,
  e.brief_id,
  null::uuid as brief_versie_id,
  null::uuid as batch_id,
  e.created_by as actor_id,
  e.kanaal,
  case
    when e.event_type = 'response_received' and e.status = 'respons_verwijderd' then 'respons_verwijderd'
    when e.event_type = 'response_received' then coalesce(e.actuele_responsstatus, e.respons_status, e.status)
    when e.event_type = 'returned_mail' then coalesce(e.actuele_responsstatus, e.respons_status, e.status)
    else coalesce(e.respons_status, e.status)
  end::text as status,
  case
    when e.event_type = 'response_received'
      and e.event_date = e.canonieke_respons_event_op
      and e.actuele_responsstatus in ('interesse','wil_meer_informatie','gesprek_gepland')
      then 'positief'
    when e.event_type = 'response_received'
      and e.event_date = e.canonieke_respons_event_op
      and e.actuele_responsstatus in ('niet_geinteresseerd','verkocht_of_niet_relevant','afgevallen')
      then 'negatief'
    when e.event_type = 'response_received'
      and e.event_date = e.canonieke_respons_event_op
      and e.actuele_responsstatus is not null
      and e.actuele_responsstatus not in ('geen_reactie','retour_post')
      then 'neutraal'
    else null
  end::text as sentiment,
  null::numeric as geraamde_kosten,
  null::numeric as werkelijke_kosten,
  null::text as valuta,
  false as telt_kadaster_aanvraag,
  false as telt_kadaster_levering,
  (e.event_type in ('posted','sent')) as telt_verzonden_communicatie,
  (
    e.event_type = 'response_received'
    and e.event_date = e.canonieke_respons_event_op
    and e.actuele_responsstatus is not null
    and e.actuele_responsstatus not in ('geen_reactie','retour_post')
  ) as telt_reactie,
  (
    e.event_type = 'response_received'
    and e.event_date = e.canonieke_respons_event_op
    and e.actuele_responsstatus in ('interesse','wil_meer_informatie','gesprek_gepland')
  ) as telt_positieve_reactie,
  (
    e.event_type = 'returned_mail'
    and e.event_date = e.canonieke_retour_event_op
    and (
      e.actuele_responsstatus = 'retour_post'
      or e.actuele_verzendstatus = 'retour'
    )
  ) as telt_retourpost,
  e.metadata
from brief_events e
where (e.vastgoedkans_id is not null) <> (e.signaal_id is not null)

union all

select
  'kadaster_kosten'::text,
  k.id::text,
  case
    when k.bron_module='vastgoedkansen' then 'vastgoedkansen'
    when k.bron_module='off_market_radar' then 'off_market_radar'
    else 'overig'
  end,
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
  case
    when p.event_type='briefnummer_uitgegeven' then 'brief_definitief_gemaakt'
    when p.event_type='batch_geprint' then 'batch_geprint'
    when p.event_type='brief_gepost' then 'communicatie_verzonden'
    else p.event_type
  end,
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
