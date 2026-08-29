-- Bundel post-opvolgbrieven als operationele Radar-werkvoorraad.
-- Historische verzendingen blijven intact; er worden geen fictieve batches aangemaakt.
-- Persoonlijke Brief 2-follow-uptaken uit de oude flow worden alleen soft-deleted.

create or replace view public.off_market_opvolgbrief_werkvoorraad
with (security_invoker = true)
as
with verzonden as (
  select
    b.id as bron_brief_id,
    b.signaal_id,
    b.relatie_id,
    b.geadresseerde_key,
    coalesce(nullif(b.geadresseerde_key, ''), '_zonder|' || b.id::text) as geadresseerde_sleutel,
    b.eigenaar_naam,
    b.eigenaar_bedrijfsnaam,
    b.verzendadres,
    b.objectadres,
    b.campagne_stap as huidige_stap,
    case b.campagne_stap
      when 'brief_1' then 1
      when 'brief_2' then 2
      when 'brief_3' then 3
      else null
    end as stap_nummer,
    b.postdatum,
    b.verzonden_op,
    b.opvolgdatum,
    b.responsstatus,
    not exists (
      select 1
      from public.off_market_printbatch_brieven pb
      where pb.brief_id = b.id
        and pb.verwijderd_op is null
    ) as legacy_zonder_batch,
    b.created_at
  from public.off_market_brieven b
  where b.archived_at is null
    and coalesce(b.kanaal, 'post') = 'post'
    and b.campagne_stap in ('brief_1', 'brief_2', 'brief_3')
    and (b.status = 'verstuurd' or b.verzendstatus = 'gepost')
), laatste_per_geadresseerde as (
  select
    v.*,
    row_number() over (
      partition by v.geadresseerde_sleutel
      order by
        v.stap_nummer desc,
        coalesce(v.postdatum, v.verzonden_op::date) desc nulls last,
        v.created_at desc,
        v.bron_brief_id desc
    ) as rn
  from verzonden v
)
select
  bron_brief_id,
  signaal_id,
  relatie_id,
  geadresseerde_key,
  geadresseerde_sleutel,
  eigenaar_naam,
  eigenaar_bedrijfsnaam,
  verzendadres,
  objectadres,
  huidige_stap,
  case huidige_stap
    when 'brief_1' then 'brief_2'
    when 'brief_2' then 'brief_3'
    else null
  end as volgende_stap,
  postdatum,
  verzonden_op,
  opvolgdatum,
  legacy_zonder_batch
from laatste_per_geadresseerde
where rn = 1
  and stap_nummer < 3
  and opvolgdatum is not null
  and (responsstatus is null or responsstatus = 'geen_reactie');

comment on view public.off_market_opvolgbrief_werkvoorraad is
  'Canonieke post-opvolgwerkvoorraad per geadresseerde. Gebruikt echte verzend-/opvolgdata, maakt geen historische batches en stopt na Brief 3.';

revoke all on public.off_market_opvolgbrief_werkvoorraad from public, anon, authenticated;
grant select on public.off_market_opvolgbrief_werkvoorraad to service_role;

create or replace function public.refresh_radar_followup_notification_events(p_user_id uuid)
returns table(created_count integer, resolved_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Amsterdam')::date;
  v_total integer := 0;
  v_brief2 integer := 0;
  v_brief3 integer := 0;
  v_max_due date;
  v_last_notified date;
  v_created integer := 0;
  v_resolved integer := 0;
  v_body text;
  v_occurrence_key text;
begin
  if p_user_id is null then
    return query select 0, 0;
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where volgende_stap = 'brief_2')::integer,
    count(*) filter (where volgende_stap = 'brief_3')::integer,
    max(opvolgdatum)
  into v_total, v_brief2, v_brief3, v_max_due
  from public.off_market_opvolgbrief_werkvoorraad
  where opvolgdatum <= v_today;

  if v_total = 0 then
    update public.notification_events
       set resolved_at = coalesce(resolved_at, now()),
           updated_at = now()
     where user_id = p_user_id
       and event_type = 'radar_followup_letters'
       and resolved_at is null;
    get diagnostics v_resolved = row_count;
    return query select 0, v_resolved;
    return;
  end if;

  if v_brief2 > 0 and v_brief3 > 0 then
    v_body := format(
      '%s opvolgbrieven klaar: %s× Brief 2 en %s× Brief 3.',
      v_total, v_brief2, v_brief3
    );
  elsif v_brief2 > 0 then
    v_body := format(
      '%s %s %s toe aan Brief 2.',
      v_brief2,
      case when v_brief2 = 1 then 'geadresseerde' else 'geadresseerden' end,
      case when v_brief2 = 1 then 'is' else 'zijn' end
    );
  else
    v_body := format(
      '%s %s %s toe aan Brief 3.',
      v_brief3,
      case when v_brief3 = 1 then 'geadresseerde' else 'geadresseerden' end,
      case when v_brief3 = 1 then 'is' else 'zijn' end
    );
  end if;

  select max((metadata ->> 'notified_through_due_date')::date)
    into v_last_notified
  from public.notification_events
  where user_id = p_user_id
    and event_type = 'radar_followup_letters'
    and metadata ? 'notified_through_due_date';

  if v_last_notified is null or v_max_due > v_last_notified then
    v_occurrence_key := 'radar_followup_letters:' || v_max_due::text;

    insert into public.notification_events (
      user_id,
      event_type,
      source_type,
      source_id,
      occurrence_key,
      title,
      body,
      priority,
      href,
      metadata
    ) values (
      p_user_id,
      'radar_followup_letters',
      'off_market_opvolging',
      'radar',
      v_occurrence_key,
      'Opvolgbrieven klaar voor actie',
      v_body,
      'normaal',
      '/off-market',
      jsonb_build_object(
        'notified_through_due_date', v_max_due,
        'current_max_due_date', v_max_due,
        'current_count', v_total,
        'brief_2_count', v_brief2,
        'brief_3_count', v_brief3,
        'werkbak', 'actie',
        'subfilter', 'opvolgen'
      )
    )
    on conflict (user_id, occurrence_key) do nothing;
    get diagnostics v_created = row_count;

    if v_created > 0 then
      update public.notification_events
         set resolved_at = now(),
             updated_at = now()
       where user_id = p_user_id
         and event_type = 'radar_followup_letters'
         and occurrence_key <> v_occurrence_key
         and resolved_at is null
         and dismissed_at is null;
      get diagnostics v_resolved = row_count;
    end if;
  end if;

  -- Houd de ene actieve melding inhoudelijk actueel wanneer de werkvoorraad krimpt,
  -- zonder daarmee een nieuwe push te veroorzaken.
  update public.notification_events e
     set body = v_body,
         metadata = e.metadata || jsonb_build_object(
           'current_max_due_date', v_max_due,
           'current_count', v_total,
           'brief_2_count', v_brief2,
           'brief_3_count', v_brief3,
           'werkbak', 'actie',
           'subfilter', 'opvolgen'
         ),
         updated_at = now()
   where e.id = (
     select id
     from public.notification_events
     where user_id = p_user_id
       and event_type = 'radar_followup_letters'
       and resolved_at is null
       and dismissed_at is null
     order by created_at desc
     limit 1
   );

  return query select v_created, v_resolved;
end;
$$;

revoke all on function public.refresh_radar_followup_notification_events(uuid) from public, anon, authenticated;
grant execute on function public.refresh_radar_followup_notification_events(uuid) to service_role;

-- Oude automatische Brief 2-taken zijn operationele werkvoorraad, geen persoonlijke taken.
-- Bewaar de historie via soft-delete en ontkoppel de briefrecords.
with oude_opvolgtaken as (
  select id
  from public.taken
  where soft_deleted_at is null
    and status = 'open'
    and type_taak = 'Follow-up'
    and titel ilike 'Brief 2 voorbereiden / opvolgen%'
)
update public.off_market_brieven b
   set gekoppelde_taak_id = null,
       updated_at = now()
 where b.gekoppelde_taak_id in (select id from oude_opvolgtaken);

with oude_opvolgtaken as (
  select id
  from public.taken
  where soft_deleted_at is null
    and status = 'open'
    and type_taak = 'Follow-up'
    and titel ilike 'Brief 2 voorbereiden / opvolgen%'
)
update public.notification_events e
   set resolved_at = coalesce(e.resolved_at, now()),
       updated_at = now()
 where e.source_type = 'taak'
   and e.source_id in (select id::text from oude_opvolgtaken)
   and e.resolved_at is null;

update public.taken
   set soft_deleted_at = now(),
       updated_at = now()
 where soft_deleted_at is null
   and status = 'open'
   and type_taak = 'Follow-up'
   and titel ilike 'Brief 2 voorbereiden / opvolgen%';
