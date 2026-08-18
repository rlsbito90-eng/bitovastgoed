-- Bito CRM — geplande taakherinneringen
-- Reminder is een expliciete planning vóór de deadline; deadline en reminder blijven semantisch gescheiden.

alter table public.notification_preferences
  add column if not exists task_default_reminder_minutes integer default 60;

alter table public.notification_preferences
  drop constraint if exists notification_preferences_task_default_reminder_minutes_check;
alter table public.notification_preferences
  add constraint notification_preferences_task_default_reminder_minutes_check
  check (task_default_reminder_minutes is null or task_default_reminder_minutes between 0 and 10080);

alter table public.taken add column if not exists reminder_policy text;
alter table public.taken add column if not exists reminder_offset_minutes integer;
alter table public.taken add column if not exists reminder_version bigint not null default 1;

-- Bestaande taken krijgen bewust geen nieuwe pushplanning tijdens rollout.
update public.taken set reminder_policy = 'none' where reminder_policy is null;

alter table public.taken alter column reminder_policy set default 'none';
alter table public.taken alter column reminder_policy set not null;

alter table public.taken drop constraint if exists taken_reminder_policy_check;
alter table public.taken add constraint taken_reminder_policy_check
  check (reminder_policy in ('default', 'none', 'custom'));

alter table public.taken drop constraint if exists taken_reminder_offset_minutes_check;
alter table public.taken add constraint taken_reminder_offset_minutes_check
  check (reminder_offset_minutes is null or reminder_offset_minutes between 0 and 10080);

alter table public.taken drop constraint if exists taken_reminder_policy_offset_check;
alter table public.taken add constraint taken_reminder_policy_offset_check
  check (
    (reminder_policy = 'custom' and reminder_offset_minutes is not null)
    or (reminder_policy in ('default', 'none') and reminder_offset_minutes is null)
  );

create index if not exists idx_taken_owner_reminder_active
  on public.taken(owner_user_id, reminder_policy, deadline, deadline_tijd)
  where soft_deleted_at is null and status not in ('afgerond', 'geannuleerd');

create index if not exists idx_notification_events_scheduled_active
  on public.notification_events(scheduled_at, user_id)
  where resolved_at is null and dismissed_at is null;

-- Bron-gegenereerde taken gebruiken de globale standaard; handmatige inserts blijven inert
-- totdat de taakdialoog de gekozen reminder atomisch meestuurt.
create or replace function public.initialize_source_task_reminder_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_kind is not null
     and new.reminder_policy = 'none'
     and new.reminder_offset_minutes is null then
    new.reminder_policy := 'default';
  end if;
  return new;
end;
$$;

revoke all on function public.initialize_source_task_reminder_policy() from public, anon, authenticated;
grant execute on function public.initialize_source_task_reminder_policy() to service_role;

drop trigger if exists trg_initialize_source_task_reminder_policy on public.taken;
create trigger trg_initialize_source_task_reminder_policy
before insert on public.taken
for each row execute function public.initialize_source_task_reminder_policy();

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
     or old.status is distinct from new.status
     or old.soft_deleted_at is distinct from new.soft_deleted_at
     or old.owner_user_id is distinct from new.owner_user_id then
    new.reminder_version := old.reminder_version + 1;
  end if;
  return new;
end;
$$;

revoke all on function public.bump_task_reminder_version() from public, anon, authenticated;
grant execute on function public.bump_task_reminder_version() to service_role;

drop trigger if exists trg_bump_task_reminder_version on public.taken;
create trigger trg_bump_task_reminder_version
before update on public.taken
for each row execute function public.bump_task_reminder_version();

create or replace function public.sync_task_reminder_event(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.taken%rowtype;
  v_timezone text := 'Europe/Amsterdam';
  v_default_minutes integer := 60;
  v_offset integer;
  v_deadline_at timestamptz;
  v_scheduled_at timestamptz;
  v_occurrence_key text;
begin
  select * into t from public.taken where id = p_task_id;

  if not found then
    return;
  end if;

  select coalesce(p.timezone, 'Europe/Amsterdam'), p.task_default_reminder_minutes
    into v_timezone, v_default_minutes
    from public.notification_preferences p
   where p.user_id = t.owner_user_id;

  v_timezone := coalesce(v_timezone, 'Europe/Amsterdam');

  if t.reminder_policy = 'custom' then
    v_offset := t.reminder_offset_minutes;
  elsif t.reminder_policy = 'default' then
    v_offset := v_default_minutes;
  else
    v_offset := null;
  end if;

  -- Een precieze reminder vereist een datum én tijd. Datum-zonder-tijd blijft de dagnotificatie gebruiken.
  if t.owner_user_id is null
     or t.soft_deleted_at is not null
     or t.status in ('afgerond', 'geannuleerd')
     or t.deadline is null
     or t.deadline_tijd is null
     or v_offset is null then
    update public.notification_events
       set resolved_at = coalesce(resolved_at, now()), updated_at = now()
     where source_type = 'taak'
       and source_id = t.id::text
       and event_type = 'task_reminder'
       and resolved_at is null;
    return;
  end if;

  v_deadline_at := (t.deadline + t.deadline_tijd) at time zone v_timezone;

  -- Geen nieuwe reminder meer plannen nadat de deadline zelf verstreken is.
  if v_deadline_at <= now() then
    update public.notification_events
       set resolved_at = coalesce(resolved_at, now()), updated_at = now()
     where source_type = 'taak'
       and source_id = t.id::text
       and event_type = 'task_reminder'
       and resolved_at is null;
    return;
  end if;

  v_scheduled_at := greatest(v_deadline_at - make_interval(mins => v_offset), now());
  v_occurrence_key := 'task_reminder:' || t.id::text || ':v' || t.reminder_version::text;

  -- Oudere reminder-episode voor dezelfde taak vervalt bij rescheduling/afronding.
  update public.notification_events
     set resolved_at = coalesce(resolved_at, now()), updated_at = now()
   where source_type = 'taak'
     and source_id = t.id::text
     and event_type = 'task_reminder'
     and occurrence_key <> v_occurrence_key
     and resolved_at is null;

  insert into public.notification_events (
    user_id, event_type, source_type, source_id, occurrence_key,
    title, body, priority, href, scheduled_at, metadata
  ) values (
    t.owner_user_id,
    'task_reminder',
    'taak',
    t.id::text,
    v_occurrence_key,
    'Taakherinnering',
    t.titel || ' · deadline ' || to_char(v_deadline_at at time zone v_timezone, 'DD-MM-YYYY HH24:MI'),
    case when t.prioriteit in ('hoog', 'urgent') then 'hoog' else 'normaal' end,
    '/taken/' || t.id::text,
    v_scheduled_at,
    jsonb_build_object(
      'deadline', t.deadline,
      'deadline_tijd', t.deadline_tijd,
      'reminder_policy', t.reminder_policy,
      'reminder_offset_minutes', v_offset,
      'deadline_at', v_deadline_at,
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

revoke all on function public.sync_task_reminder_event(uuid) from public, anon, authenticated;
grant execute on function public.sync_task_reminder_event(uuid) to service_role;

create or replace function public.trigger_sync_task_reminder_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_task_reminder_event(new.id);
  return new;
end;
$$;

revoke all on function public.trigger_sync_task_reminder_event() from public, anon, authenticated;
grant execute on function public.trigger_sync_task_reminder_event() to service_role;

drop trigger if exists trg_sync_task_reminder_event on public.taken;
create trigger trg_sync_task_reminder_event
after insert or update of deadline, deadline_tijd, reminder_policy, reminder_offset_minutes, status, soft_deleted_at, owner_user_id, titel, prioriteit
on public.taken
for each row execute function public.trigger_sync_task_reminder_event();

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
      select id from public.taken
       where owner_user_id = new.user_id
         and reminder_policy = 'default'
         and soft_deleted_at is null
         and status not in ('afgerond', 'geannuleerd')
    loop
      perform public.sync_task_reminder_event(r.id);
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function public.resync_default_task_reminders() from public, anon, authenticated;
grant execute on function public.resync_default_task_reminders() to service_role;

drop trigger if exists trg_resync_default_task_reminders on public.notification_preferences;
create trigger trg_resync_default_task_reminders
after insert or update of task_default_reminder_minutes, timezone
on public.notification_preferences
for each row execute function public.resync_default_task_reminders();

-- Dagnotificaties blijven uitsluitend voor taken zonder exact tijdstip.
create or replace function public.refresh_task_notification_events(p_user_id uuid)
returns table(created_count integer, resolved_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Amsterdam')::date;
  v_created integer := 0;
  v_resolved integer := 0;
begin
  if p_user_id is null then
    return query select 0, 0;
    return;
  end if;

  insert into public.notification_events (
    user_id, event_type, source_type, source_id, occurrence_key,
    title, body, priority, href, metadata
  )
  select
    t.owner_user_id,
    'task_due_today',
    'taak',
    t.id::text,
    'task_due_today:' || t.id::text || ':' || v_today::text || ':all-day',
    'Taak verloopt vandaag',
    t.titel,
    'hoog',
    '/taken/' || t.id::text,
    jsonb_build_object('deadline', t.deadline, 'prioriteit', t.prioriteit)
  from public.taken t
  where t.owner_user_id = p_user_id
    and t.soft_deleted_at is null
    and t.status not in ('afgerond', 'geannuleerd')
    and t.deadline = v_today
    and t.deadline_tijd is null
  on conflict (user_id, occurrence_key) do nothing;
  get diagnostics v_created = row_count;

  insert into public.notification_events (
    user_id, event_type, source_type, source_id, occurrence_key,
    title, body, priority, href, metadata
  )
  select
    t.owner_user_id,
    'task_overdue',
    'taak',
    t.id::text,
    'task_overdue:' || t.id::text || ':' || t.deadline::text || ':' || coalesce(left(t.deadline_tijd::text, 5), 'eod'),
    'Taak verlopen',
    t.titel,
    'kritiek',
    '/taken/' || t.id::text,
    jsonb_build_object('deadline', t.deadline, 'deadline_tijd', t.deadline_tijd, 'prioriteit', t.prioriteit)
  from public.taken t
  where t.owner_user_id = p_user_id
    and t.soft_deleted_at is null
    and t.status not in ('afgerond', 'geannuleerd')
    and t.deadline is not null
    and t.deadline < v_today
  on conflict (user_id, occurrence_key) do nothing;
  get diagnostics v_resolved = row_count;
  v_created := v_created + v_resolved;
  v_resolved := 0;

  insert into public.notification_events (
    user_id, event_type, source_type, source_id, occurrence_key,
    title, body, priority, href, metadata
  )
  select
    t.owner_user_id,
    'high_priority_task',
    'taak',
    t.id::text,
    'high_priority_task:' || t.id::text,
    case when t.prioriteit = 'urgent' then 'Urgente taak' else 'Hoge prioriteitstaak' end,
    t.titel,
    'hoog',
    '/taken/' || t.id::text,
    jsonb_build_object('deadline', t.deadline, 'deadline_tijd', t.deadline_tijd, 'prioriteit', t.prioriteit)
  from public.taken t
  where t.owner_user_id = p_user_id
    and t.soft_deleted_at is null
    and t.status not in ('afgerond', 'geannuleerd')
    and t.prioriteit in ('hoog', 'urgent')
  on conflict (user_id, occurrence_key) do nothing;
  get diagnostics v_resolved = row_count;
  v_created := v_created + v_resolved;
  v_resolved := 0;

  update public.notification_events e
     set resolved_at = now(), updated_at = now()
   where e.user_id = p_user_id
     and e.source_type = 'taak'
     and e.resolved_at is null
     and e.event_type in ('task_due_today', 'task_overdue', 'high_priority_task')
     and (
       not exists (
         select 1 from public.taken t
          where t.id::text = e.source_id
            and t.owner_user_id = p_user_id
            and t.soft_deleted_at is null
            and t.status not in ('afgerond', 'geannuleerd')
       )
       or (e.event_type = 'task_due_today' and not exists (
         select 1 from public.taken t
          where t.id::text = e.source_id and t.owner_user_id = p_user_id
            and t.soft_deleted_at is null and t.status not in ('afgerond', 'geannuleerd')
            and t.deadline = v_today and t.deadline_tijd is null
       ))
       or (e.event_type = 'task_overdue' and not exists (
         select 1 from public.taken t
          where t.id::text = e.source_id and t.owner_user_id = p_user_id
            and t.soft_deleted_at is null and t.status not in ('afgerond', 'geannuleerd')
            and t.deadline is not null and t.deadline < v_today
       ))
       or (e.event_type = 'high_priority_task' and not exists (
         select 1 from public.taken t
          where t.id::text = e.source_id and t.owner_user_id = p_user_id
            and t.soft_deleted_at is null and t.status not in ('afgerond', 'geannuleerd')
            and t.prioriteit in ('hoog', 'urgent')
       ))
     );
  get diagnostics v_resolved = row_count;

  return query select v_created, v_resolved;
end;
$$;

revoke all on function public.refresh_task_notification_events(uuid) from public, anon, authenticated;
grant execute on function public.refresh_task_notification_events(uuid) to service_role;

-- Oude actieve timed due-events verdwijnen uit de actieve bel; verzendhistorie blijft intact.
update public.notification_events e
   set resolved_at = now(), updated_at = now()
  from public.taken t
 where e.source_type = 'taak'
   and e.source_id = t.id::text
   and e.event_type = 'task_due_today'
   and e.resolved_at is null
   and t.deadline_tijd is not null;

comment on column public.taken.reminder_policy is 'default = gebruikersstandaard, none = geen precieze reminder, custom = reminder_offset_minutes.';
comment on column public.taken.reminder_offset_minutes is 'Aantal minuten vóór de exacte taakdeadline; alleen bij reminder_policy=custom.';
comment on column public.notification_preferences.task_default_reminder_minutes is 'Gebruikersstandaard voor exacte taakherinneringen; null = geen standaardmelding.';
