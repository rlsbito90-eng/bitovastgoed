-- Bito CRM — centrale notificatie- en multi-device fundering
-- Additief: bestaande user_notification_state blijft voorlopig intact voor pariteit/migratie.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time without time zone,
  quiet_hours_end time without time zone,
  timezone text not null default 'Europe/Amsterdam',
  task_due_enabled boolean not null default true,
  task_overdue_enabled boolean not null default true,
  high_priority_task_enabled boolean not null default true,
  bid_expiry_enabled boolean not null default true,
  strong_match_enabled boolean not null default false,
  data_quality_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not quiet_hours_enabled
    or (quiet_hours_start is not null and quiet_hours_end is not null)
  )
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own"
on public.notification_preferences for select to authenticated
using (auth.uid() = user_id);

create policy "notification_preferences_insert_own"
on public.notification_preferences for insert to authenticated
with check (auth.uid() = user_id);

create policy "notification_preferences_update_own"
on public.notification_preferences for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source_type text not null,
  source_id text not null,
  occurrence_key text not null,
  title text not null,
  body text,
  priority text not null default 'normaal'
    check (priority in ('laag', 'normaal', 'hoog', 'kritiek')),
  href text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  unique (user_id, occurrence_key)
);

create index if not exists notification_events_user_active_idx
  on public.notification_events (user_id, created_at desc)
  where resolved_at is null and dismissed_at is null;

create index if not exists notification_events_schedule_idx
  on public.notification_events (scheduled_at)
  where resolved_at is null and dismissed_at is null;

alter table public.notification_events enable row level security;

create policy "notification_events_select_own"
on public.notification_events for select to authenticated
using (auth.uid() = user_id);

create policy "notification_events_update_own"
on public.notification_events for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Event-creatie gebeurt uiteindelijk server-side (service role / gecontroleerde RPC),
-- daarom bewust geen authenticated INSERT-policy op notification_events.
grant select, update on public.notification_events to authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  device_label text,
  platform text,
  browser text,
  display_mode text,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, last_seen_at desc)
  where revoked_at is null and push_enabled = true;

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
on public.push_subscriptions for select to authenticated
using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
on public.push_subscriptions for insert to authenticated
with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
on public.push_subscriptions for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
on public.push_subscriptions for delete to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_event_id uuid not null references public.notification_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  retry_count integer not null default 0 check (retry_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_event_id, subscription_id)
);

create index if not exists notification_deliveries_pending_idx
  on public.notification_deliveries (queued_at)
  where sent_at is null and failed_at is null;

alter table public.notification_deliveries enable row level security;

create policy "notification_deliveries_select_own"
on public.notification_deliveries for select to authenticated
using (
  exists (
    select 1
    from public.notification_events e
    where e.id = notification_event_id
      and e.user_id = auth.uid()
  )
);

grant select on public.notification_deliveries to authenticated;

-- Realtime is nodig zodat gelezen/opgelost op één device direct op andere
-- actieve clients zichtbaar wordt. Guard voorkomt dubbel toevoegen bij herstel/replay.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notification_events'
     ) then
    alter publication supabase_realtime add table public.notification_events;
  end if;
end
$$;

comment on table public.notification_events is
  'Gebruikersbrede logische notificaties; read/dismiss/resolve synchroniseren over alle apparaten.';

comment on table public.push_subscriptions is
  'Device-specifieke Web Push subscriptions; meerdere endpoints per gebruiker zijn toegestaan.';

comment on table public.notification_deliveries is
  'Idempotente deliveryregistratie per notificatie-event en device subscription.';
