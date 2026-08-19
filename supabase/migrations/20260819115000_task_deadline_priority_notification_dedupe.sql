-- Bito CRM — voorkom dubbele taakpush bij een expliciete deadline.
-- Architectuurcontract: hoge/urgente creatiemelding is uitsluitend voor open taken zonder deadline.
-- Taken met een deadline worden via task_due_today / task_reminder / task_overdue afgehandeld.

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

  -- Belangrijk: prioriteit is geen extra timinginstructie als er al een deadline bestaat.
  -- Zo veroorzaakt "Melding: bij deadline" niet daarnaast een directe high-priority push.
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
    and t.deadline is null
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
            and t.deadline is null
       ))
     );
  get diagnostics v_resolved = row_count;

  return query select v_created, v_resolved;
end;
$$;

revoke all on function public.refresh_task_notification_events(uuid) from public, anon;
grant execute on function public.refresh_task_notification_events(uuid) to authenticated, service_role;

-- Repareer reeds actieve high-priority events die bij deadline-taken horen.
-- De push-sender behandelt een resolved event als inactief en zal een nog niet verzonden delivery niet meer versturen.
update public.notification_events e
   set resolved_at = coalesce(e.resolved_at, now()),
       updated_at = now()
 where e.source_type = 'taak'
   and e.event_type = 'high_priority_task'
   and e.resolved_at is null
   and exists (
     select 1
       from public.taken t
      where t.id::text = e.source_id
        and t.deadline is not null
   );
