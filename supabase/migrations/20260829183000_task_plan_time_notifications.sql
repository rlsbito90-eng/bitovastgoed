-- Bito CRM — geplande taakmeldingen
-- Werkplanning blijft los van harde deadlines, maar plan_datum + plan_tijd
-- veroorzaakt wel een pushmelding op het geplande moment.

create or replace function public.bump_task_reminder_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deadline is distinct from new.deadline
     or old.deadline_tijd is distinct from new.deadline_tijd
     or old.reminder_policy is distinct from new.reminder_policy
     or old.reminder_offset_minutes is distinct from new.reminder_offset_minutes
     or old.prioriteit is distinct from new.prioriteit
     or old.status is distinct from new.status
     or old.soft_deleted_at is distinct from new.soft_deleted_at
     or old.owner_user_id is distinct from new.owner_user_id
     or old.plan_datum is distinct from new.plan_datum
     or old.plan_tijd is distinct from new.plan_tijd then
    new.reminder_version := old.reminder_version + 1;
  end if;
  return new;
end;
$$;

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

  if t.owner_user_id is null
     or t.soft_deleted_at is not null
     or t.status in ('afgerond', 'geannuleerd')
     or t.plan_datum is null
     or t.plan_tijd is null then
    update public.notification_events
       set resolved_at = coalesce(resolved_at, now()),
           updated_at = now()
     where source_type = 'taak'
       and source_id = t.id::text
       and event_type = 'task_plan_reminder'
       and resolved_at is null;
    return;
  end if;

  v_plan_at := (t.plan_datum + t.plan_tijd) at time zone v_timezone;

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

create or replace function public.trigger_sync_task_reminder_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_task_reminder_event(new.id);
  perform public.sync_task_plan_reminder_event(new.id);
  return new;
end;
$$;

drop trigger if exists trg_sync_task_reminder_event on public.taken;
create trigger trg_sync_task_reminder_event
after insert or update of
  deadline,
  deadline_tijd,
  reminder_policy,
  reminder_offset_minutes,
  status,
  soft_deleted_at,
  owner_user_id,
  titel,
  prioriteit,
  plan_datum,
  plan_tijd
on public.taken
for each row
execute function public.trigger_sync_task_reminder_event();

create or replace function public.resync_default_task_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if tg_op = 'INSERT'
     or old.task_default_reminder_minutes is distinct from new.task_default_reminder_minutes
     or old.timezone is distinct from new.timezone then
    for r in
      select id
      from public.taken
      where owner_user_id = new.user_id
        and soft_deleted_at is null
        and status not in ('afgerond', 'geannuleerd')
    loop
      if exists (
        select 1
        from public.taken t
        where t.id = r.id
          and t.reminder_policy = 'default'
      ) then
        perform public.sync_task_reminder_event(r.id);
      end if;
      perform public.sync_task_plan_reminder_event(r.id);
    end loop;
  end if;
  return new;
end;
$$;

-- Maak toekomstige reeds ingeplande taken direct bekend bij de notificatie-engine.
do $$
declare
  r record;
begin
  for r in
    select t.id
    from public.taken t
    left join public.notification_preferences p on p.user_id = t.owner_user_id
    where t.owner_user_id is not null
      and t.soft_deleted_at is null
      and t.status not in ('afgerond', 'geannuleerd')
      and t.plan_datum is not null
      and t.plan_tijd is not null
      and (t.plan_datum + t.plan_tijd) at time zone coalesce(p.timezone, 'Europe/Amsterdam') > now()
  loop
    perform public.sync_task_plan_reminder_event(r.id);
  end loop;
end;
$$;
