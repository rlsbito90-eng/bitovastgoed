-- Bito CRM — timed task notification scheduling
-- Timed deadlines notify at/after their explicit clock time; date-only tasks retain day semantics.
-- Same-day timed deadlines do not immediately create a second overdue notification.

create or replace function public.refresh_task_notification_events(p_user_id uuid)
returns table(created_count integer, resolved_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Amsterdam')::date;
  v_now_local timestamp := now() at time zone 'Europe/Amsterdam';
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
    'task_due_today:' || t.id::text || ':' || v_today::text || ':' || coalesce(left(t.deadline_tijd::text, 5), 'all-day'),
    case when t.deadline_tijd is not null then 'Taakdeadline bereikt' else 'Taak verloopt vandaag' end,
    t.titel || case when t.deadline_tijd is not null then ' · ' || left(t.deadline_tijd::text, 5) else '' end,
    'hoog',
    '/taken/' || t.id::text,
    jsonb_build_object('deadline', t.deadline, 'deadline_tijd', t.deadline_tijd, 'prioriteit', t.prioriteit)
  from public.taken t
  where t.owner_user_id = p_user_id
    and t.soft_deleted_at is null
    and t.status not in ('afgerond', 'geannuleerd')
    and t.deadline = v_today
    and (
      t.deadline_tijd is null
      or (t.deadline + t.deadline_tijd) <= v_now_local
    )
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
     and (
       not exists (
         select 1 from public.taken t
          where t.id::text = e.source_id
            and t.owner_user_id = p_user_id
            and t.soft_deleted_at is null
            and t.status not in ('afgerond', 'geannuleerd')
       )
       or (
         e.event_type = 'task_due_today'
         and not exists (
           select 1 from public.taken t
            where t.id::text = e.source_id
              and t.owner_user_id = p_user_id
              and t.soft_deleted_at is null
              and t.status not in ('afgerond', 'geannuleerd')
              and t.deadline = v_today
              and (
                t.deadline_tijd is null
                or (t.deadline + t.deadline_tijd) <= v_now_local
              )
              and e.occurrence_key = 'task_due_today:' || t.id::text || ':' || v_today::text || ':' || coalesce(left(t.deadline_tijd::text, 5), 'all-day')
         )
       )
       or (
         e.event_type = 'high_priority_task'
         and not exists (
           select 1 from public.taken t
            where t.id::text = e.source_id
              and t.owner_user_id = p_user_id
              and t.soft_deleted_at is null
              and t.status not in ('afgerond', 'geannuleerd')
              and t.prioriteit in ('hoog', 'urgent')
         )
       )
       or (
         e.event_type = 'task_overdue'
         and not exists (
           select 1 from public.taken t
            where t.id::text = e.source_id
              and t.owner_user_id = p_user_id
              and t.soft_deleted_at is null
              and t.status not in ('afgerond', 'geannuleerd')
              and t.deadline is not null
              and t.deadline < v_today
         )
       )
     );
  get diagnostics v_resolved = row_count;

  return query select v_created, v_resolved;
end;
$$;

revoke all on function public.refresh_task_notification_events(uuid) from public;
revoke all on function public.refresh_task_notification_events(uuid) from anon;
revoke all on function public.refresh_task_notification_events(uuid) from authenticated;
grant execute on function public.refresh_task_notification_events(uuid) to service_role;

do $$
declare
  v_today date := (now() at time zone 'Europe/Amsterdam')::date;
begin
  update public.notification_events e
     set occurrence_key = 'task_due_today:' || t.id::text || ':' || v_today::text || ':' || coalesce(left(t.deadline_tijd::text, 5), 'all-day'),
         title = case when t.deadline_tijd is not null then 'Taakdeadline bereikt' else 'Taak verloopt vandaag' end,
         body = t.titel || case when t.deadline_tijd is not null then ' · ' || left(t.deadline_tijd::text, 5) else '' end,
         metadata = jsonb_build_object('deadline', t.deadline, 'deadline_tijd', t.deadline_tijd, 'prioriteit', t.prioriteit),
         updated_at = now()
    from public.taken t
   where e.user_id = t.owner_user_id
     and e.source_type = 'taak'
     and e.source_id = t.id::text
     and e.event_type = 'task_due_today'
     and e.resolved_at is null
     and t.deadline = v_today
     and e.occurrence_key <> 'task_due_today:' || t.id::text || ':' || v_today::text || ':' || coalesce(left(t.deadline_tijd::text, 5), 'all-day');

  update public.notification_events e
     set resolved_at = now(), updated_at = now()
    from public.taken t
   where e.user_id = t.owner_user_id
     and e.source_type = 'taak'
     and e.source_id = t.id::text
     and e.event_type = 'task_overdue'
     and e.resolved_at is null
     and t.deadline = v_today;
end $$;

comment on function public.refresh_task_notification_events(uuid) is
  'Idempotente taaknotificatieprojectie: timed deadlines pas vanaf hun expliciete Amsterdam-tijd; overdue als volgende-dag escalatie.';
