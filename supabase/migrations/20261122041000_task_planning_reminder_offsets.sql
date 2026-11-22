-- Uitgebreide planningsherinneringen, los van de harde deadline.
-- Additief: bestaande taakinstellingen en geplande notificatie-events worden
-- niet aangepast. Nieuwe keuzes volgen via de bestaande taakt rigger.

alter table public.taken drop constraint if exists taken_plan_reminder_mode_check;
alter table public.taken add constraint taken_plan_reminder_mode_check
  check (plan_reminder_mode in ('none', 'at_time', 'on_day', 'day_before', 'offset_5', 'offset_10', 'offset_15', 'offset_30', 'offset_60', 'offset_120', 'offset_1440', 'offset_2880', 'offset_10080'));

create or replace function public.sync_task_plan_reminder_event(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.taken%rowtype;
  v_timezone text := 'Europe/Amsterdam';
  v_plan_at timestamptz;
  v_occurrence_key text;
  v_mode text;
  v_offset_minutes integer;
begin
  select * into t
  from public.taken
  where id = p_task_id;

  if not found then
    return;
  end if;

  select coalesce(p.timezone, 'Europe/Amsterdam')
    into v_timezone
    from public.notification_preferences p
   where p.user_id = t.owner_user_id;

  v_timezone := coalesce(v_timezone, 'Europe/Amsterdam');
  v_mode := coalesce(t.plan_reminder_mode, 'at_time');

  if t.owner_user_id is null
     or t.soft_deleted_at is not null
     or t.status in ('afgerond', 'geannuleerd')
     or t.plan_datum is null
     or v_mode = 'none'
     or (v_mode = 'at_time' and t.plan_tijd is null)
     or (v_mode like 'offset_%' and t.plan_tijd is null
         and substring(v_mode from 8)::integer < 1440) then
    update public.notification_events
       set resolved_at = coalesce(resolved_at, now()),
           updated_at = now()
     where source_type = 'taak'
       and source_id = t.id::text
       and event_type = 'task_plan_reminder'
       and resolved_at is null;
    return;
  end if;

  if v_mode like 'offset_%' then
    v_offset_minutes := substring(v_mode from 8)::integer;
    if v_offset_minutes >= 1440 then
      -- Kalenderdagen, niet UTC-uren, zodat 09:00 lokale tijd bij zomertijd
      -- ook echt 09:00 blijft. Zonder werktijd gebruiken we 09:00.
      v_plan_at := ((t.plan_datum - (v_offset_minutes / 1440)) +
                    coalesce(t.plan_tijd, time '09:00')) at time zone v_timezone;
    else
      -- Minuten/uren tellen vanaf het exact gekozen werkmoment.
      v_plan_at := ((t.plan_datum + t.plan_tijd) at time zone v_timezone)
                   - make_interval(mins => v_offset_minutes);
    end if;
  else
    v_plan_at := case v_mode
      when 'on_day' then (t.plan_datum + time '09:00') at time zone v_timezone
      when 'day_before' then ((t.plan_datum - 1) + time '09:00') at time zone v_timezone
      else (t.plan_datum + t.plan_tijd) at time zone v_timezone
    end;
  end if;

  if v_plan_at <= now() then
    update public.notification_events
       set resolved_at = coalesce(resolved_at, now()),
           updated_at = now()
     where source_type = 'taak'
       and source_id = t.id::text
       and event_type = 'task_plan_reminder'
       and resolved_at is null;
    return;
  end if;

  v_occurrence_key := 'task_plan_reminder:' || t.id::text || ':v' || t.reminder_version::text;

  update public.notification_events
     set resolved_at = coalesce(resolved_at, now()),
         updated_at = now()
   where source_type = 'taak'
     and source_id = t.id::text
     and event_type = 'task_plan_reminder'
     and occurrence_key <> v_occurrence_key
     and resolved_at is null;

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
    scheduled_at,
    metadata
  ) values (
    t.owner_user_id,
    'task_plan_reminder',
    'taak',
    t.id::text,
    v_occurrence_key,
    'Tijd voor je taak',
    t.titel,
    case when t.prioriteit in ('hoog', 'urgent') then 'hoog' else 'normaal' end,
    '/taken/' || t.id::text,
    v_plan_at,
    jsonb_build_object(
      'kind', 'work_plan',
      'plan_datum', t.plan_datum,
      'plan_tijd', t.plan_tijd,
      'reminder_mode', v_mode,
      'plan_at', v_plan_at,
      'timezone', v_timezone
    )
  )
  on conflict (user_id, occurrence_key) do update
    set title = excluded.title,
        body = excluded.body,
        priority = excluded.priority,
        href = excluded.href,
        scheduled_at = excluded.scheduled_at,
        metadata = excluded.metadata,
        updated_at = now()
  where public.notification_events.resolved_at is null
    and public.notification_events.dismissed_at is null;
end;
$$;



-- Alleen de bestaande beveiligde serverflow mag de planningssync aanroepen.
revoke all on function public.sync_task_plan_reminder_event(uuid) from public, anon, authenticated;
grant execute on function public.sync_task_plan_reminder_event(uuid) to service_role;
