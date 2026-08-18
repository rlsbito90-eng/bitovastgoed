-- Bito CRM — prequeue deliveries voor geplande events
-- De delivery bestaat vóór de reminder-minute, maar de sender mag hem pas vanaf available_at versturen.

alter table public.notification_deliveries
  add column if not exists available_at timestamptz;

update public.notification_deliveries d
   set available_at = coalesce(e.scheduled_at, e.created_at, d.queued_at, now())
  from public.notification_events e
 where e.id = d.notification_event_id
   and d.available_at is null;

update public.notification_deliveries
   set available_at = coalesce(available_at, queued_at, now())
 where available_at is null;

alter table public.notification_deliveries
  alter column available_at set default now();
alter table public.notification_deliveries
  alter column available_at set not null;

create index if not exists idx_notification_deliveries_due_pending
  on public.notification_deliveries(available_at, queued_at)
  where sent_at is null and failed_at is null;

comment on column public.notification_deliveries.available_at is
  'Exact servermoment vanaf wanneer deze device-delivery verzonden mag worden; maakt prequeue vóór scheduled_at mogelijk.';
