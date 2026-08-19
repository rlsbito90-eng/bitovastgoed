-- Bito CRM — prioriteitsattentie is een aparte, geplande waarschuwing vóór een concrete taakdeadline.
-- Contract:
--   * urgent: 60 minuten vóór deadline+tijd
--   * hoog: 30 minuten vóór deadline+tijd
--   * zonder deadline/tijd: geen prioriteitspush
--   * reminder_policy = none: geen prioriteitspush
--   * taak aangemaakt/gewijzigd binnen de voorlooptijd: geen onmiddellijke inhaalpush
--   * valt prioriteitsattentie exact samen met de gewone task_reminder: geen tweede event

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
     or old.owner_user_id is distinct from new.owner_user_id then
    new.reminder_version := old.reminder_version + 1;
  end if;
  return new;
end;
$$;

revoke all on function public.bump_task_reminder_version() from public, anon, authenticated;
grant execute on function public.bump_task_reminder_version() to service_role;

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

  -- Prioriteitsattentie: niet bij creatie, maar alleen vóór een concrete toekomstige deadline+tijd.
  -- reminder_version maakt iedere rescheduling/priority-wijziging een nieuwe logische episode.
  insert into public.notification_events (
    user_id, event_type, source_type, source_id, occurrence_key,
    title, body, priority, href, scheduled_at, metadata
  )
  select
    t.owner_user_id,
    'high_priority_task',
    'taak',
    t.id::text,
    'high_priority_task:' || t.id::text || ':v' || t.reminder_version::text,
    case when t.prioriteit = 'urgent' then 'Urgente taak' else 'Hoge prioriteitstaak' end,
    t.titel,
    'hoog',
    '/taken/' || t.id::text,
    x.attention_at,
    jsonb_build_object(
      'deadline', t.deadline,
      'deadline_tijd', t.deadline_tijd,
      'prioriteit', t.prioriteit,
      'attention_offset_minutes', x.attention_minutes,
      'deadline_at', x.deadline_at,
      'timezone', coalesce(p.timezone, 'Europe/Amsterdam')
    )
  from public.taken t
  left join public.notification_preferences p on p.user_id = t.owner_user_id
  cross join lateral (
    select
      case when t.prioriteit = 'urgent' then 60 else 30 end as attention_minutes,
      (t.deadline + t.deadline_tijd) at time zone coalesce(p.timezone, 'Europe/Amsterdam') as deadline_at
  ) d
  cross join lateral (
    select
      d.attention_minutes,
      d.deadline_at,
      d.deadline_at - make_interval(mins => d.attention_minutes) as attention_at
  ) x
  where t.owner_user_id = p_user_id
    and t.soft_deleted_at is null
    and t.status not in ('afgerond', 'geannuleerd')
    and t.prioriteit in ('hoog', 'urgent')
    and t.deadline is not null
    and t.deadline_tijd is not null
    and t.reminder_policy <> 'none'
    and x.deadline_at > now()
    and x.attention_at > now()
    and not exists (
      select 1
      from public.notification_events r
      where r.user_id = t.owner_user_id
        and r.source_type = 'taak'
        and r.source_id = t.id::text
        and r.event_type = 'task_reminder'
        and r.resolved_at is null
        and r.dismissed_at is null
        and r.scheduled_at = x.attention_at
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
  get diagnostics v_resolved = row_count;
  v_created := v_created + v_resolved;
  v_resolved := 0;

  -- Oude of niet langer geldige prioriteits-episodes sluiten.
  -- Een reeds vooraf geplande episode blijft na scheduled_at actief tot de deadline,
  -- zodat engine-tick hem niet vlak vóór de push-sender resolve't.
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
         select 1
         from public.taken t
         left join public.notification_preferences p on p.user_id = t.owner_user_id
         cross join lateral (
           select
             case when t.prioriteit = 'urgent' then 60 else 30 end as attention_minutes,
             (t.deadline + t.deadline_tijd) at time zone coalesce(p.timezone, 'Europe/Amsterdam') as deadline_at
         ) d
         cross join lateral (
           select d.deadline_at - make_interval(mins => d.attention_minutes) as attention_at
         ) x
         where t.id::text = e.source_id
           and t.owner_user_id = p_user_id
           and t.soft_deleted_at is null
           and t.status not in ('afgerond', 'geannuleerd')
           and t.prioriteit in ('hoog', 'urgent')
           and t.deadline is not null
           and t.deadline_tijd is not null
           and t.reminder_policy <> 'none'
           and d.deadline_at > now()
           and e.occurrence_key = 'high_priority_task:' || t.id::text || ':v' || t.reminder_version::text
           and not exists (
             select 1
             from public.notification_events r
             where r.user_id = t.owner_user_id
               and r.source_type = 'taak'
               and r.source_id = t.id::text
               and r.event_type = 'task_reminder'
               and r.resolved_at is null
               and r.dismissed_at is null
               and r.scheduled_at = x.attention_at
           )
       ))
     );
  get diagnostics v_resolved = row_count;

  return query select v_created, v_resolved;
end;
$$;

revoke all on function public.refresh_task_notification_events(uuid) from public, anon;
grant execute on function public.refresh_task_notification_events(uuid) to authenticated, service_role;

-- De vorige release kon nog directe high_priority_task-events zonder scheduling hebben.
-- Sluit ze zodat alleen het nieuwe geplande contract overblijft.
update public.notification_events
   set resolved_at = coalesce(resolved_at, now()),
       updated_at = now()
 where source_type = 'taak'
   and event_type = 'high_priority_task'
   and resolved_at is null
   and scheduled_at is null;
