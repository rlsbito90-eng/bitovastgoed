-- Bito CRM: één gebruikersmelding per open website-investeringsprofiel,
-- dagelijkse herinnering voor niet-afgehandelde aanvragen en automatisch oplossen.
-- Brondata van inzendingen en bestaande relaties blijven onveranderd.

alter table public.notification_preferences
  add column if not exists website_intake_enabled boolean not null default true;

create or replace function public.sync_website_intake_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text in ('ontvangen','nieuw_te_controleren','bestaande_relatie','dubbelzinnig') then
    insert into public.notification_events
      (user_id,event_type,source_type,source_id,occurrence_key,title,body,priority,href,metadata)
    select p.user_id,
      'website_intake_pending','website_investeringsprofiel',new.id::text,
      'website_intake_pending:' || new.id::text,
      'Nieuw investeringsprofiel te beoordelen',
      'Een website-investeringsprofiel staat klaar in Relaties.',
      'hoog',
      '/relaties?website_inbox=1&intake_id=' || new.id::text,
      jsonb_build_object('intake_id',new.id::text)
    from public.notification_preferences p
    where p.in_app_enabled = true and p.website_intake_enabled = true
    on conflict (user_id,occurrence_key) do nothing;
  else
    update public.notification_events e
       set resolved_at = now(), updated_at = now()
     where e.source_type = 'website_investeringsprofiel'
       and e.source_id = new.id::text
       and e.resolved_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_website_intake_notifications() from public, anon, authenticated;
drop trigger if exists trg_website_intake_notifications on public.website_investor_intakes;
create trigger trg_website_intake_notifications
after insert or update of status on public.website_investor_intakes
for each row execute function public.sync_website_intake_notifications();

-- Eénmalig veilig inhalen van reeds openstaande aanvragen, zonder statuswijziging.
insert into public.notification_events
  (user_id,event_type,source_type,source_id,occurrence_key,title,body,priority,href,metadata)
select p.user_id,'website_intake_pending','website_investeringsprofiel',i.id::text,
       'website_intake_pending:' || i.id::text,
       'Nieuw investeringsprofiel te beoordelen',
       'Een website-investeringsprofiel staat klaar in Relaties.',
       'hoog','/relaties?website_inbox=1&intake_id=' || i.id::text,
       jsonb_build_object('intake_id',i.id::text)
from public.website_investor_intakes i
cross join public.notification_preferences p
where i.status::text in ('ontvangen','nieuw_te_controleren','bestaande_relatie','dubbelzinnig')
  and p.in_app_enabled = true and p.website_intake_enabled = true
on conflict (user_id,occurrence_key) do nothing;

create or replace function public.refresh_website_intake_notification_events(p_user_id uuid)
returns table(created_count integer,resolved_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day text := to_char(now() at time zone 'Europe/Amsterdam','YYYY-MM-DD');
  v_hour int := extract(hour from now() at time zone 'Europe/Amsterdam');
  v_created integer := 0;
  v_resolved integer := 0;
begin
  if p_user_id is null then
    return query select 0,0;
    return;
  end if;
  -- Na 24 uur, vanaf 09:00 lokale tijd, maximaal één herinnering per dag
  -- en nooit opnieuw herinneren wanneer de hoofdnotificatie expliciet is verborgen.
  if v_hour >= 9 then
    insert into public.notification_events
      (user_id,event_type,source_type,source_id,occurrence_key,title,body,priority,href,metadata)
    select p_user_id,'website_intake_reminder','website_investeringsprofiel',i.id::text,
      'website_intake_reminder:' || i.id::text || ':' || v_day,
      'Investeringsprofiel wacht op beoordeling',
      'Er staat nog een website-investeringsprofiel in de wachtrij.',
      'hoog','/relaties?website_inbox=1&intake_id=' || i.id::text,
      jsonb_build_object('intake_id',i.id::text)
    from public.website_investor_intakes i
    join public.notification_preferences p on p.user_id = p_user_id
    where i.status::text in ('ontvangen','nieuw_te_controleren','bestaande_relatie','dubbelzinnig')
      and i.created_at <= now() - interval '24 hours'
      and p.in_app_enabled = true and p.website_intake_enabled = true
      and exists (
        select 1 from public.notification_events e
        where e.user_id = p_user_id
          and e.occurrence_key = 'website_intake_pending:' || i.id::text
          and e.dismissed_at is null
          and e.resolved_at is null
      )
    on conflict (user_id,occurrence_key) do nothing;
    get diagnostics v_created = row_count;
  end if;
  -- Safety net voor statusveranderingen die buiten de trigger om zijn uitgevoerd.
  update public.notification_events e
     set resolved_at = now(),updated_at = now()
  where e.user_id = p_user_id
    and e.source_type = 'website_investeringsprofiel'
    and e.resolved_at is null
    and not exists (
      select 1 from public.website_investor_intakes i
      where i.id::text=e.source_id
        and i.status::text in ('ontvangen','nieuw_te_controleren','bestaande_relatie','dubbelzinnig')
    );
  get diagnostics v_resolved = row_count;
  return query select v_created,v_resolved;
end;
$$;
revoke all on function public.refresh_website_intake_notification_events(uuid)
  from public,anon,authenticated;
grant execute on function public.refresh_website_intake_notification_events(uuid) to service_role;
