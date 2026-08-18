-- Bito CRM — houd prequeued deliveries synchroon met event-rescheduling.

create or replace function public.sync_notification_delivery_available_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.scheduled_at is distinct from new.scheduled_at then
    update public.notification_deliveries
       set available_at = coalesce(new.scheduled_at, new.created_at),
           updated_at = now()
     where notification_event_id = new.id
       and sent_at is null
       and failed_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_notification_delivery_available_at() from public, anon, authenticated;
grant execute on function public.sync_notification_delivery_available_at() to service_role;

drop trigger if exists trg_sync_notification_delivery_available_at on public.notification_events;
create trigger trg_sync_notification_delivery_available_at
after update of scheduled_at on public.notification_events
for each row execute function public.sync_notification_delivery_available_at();

comment on function public.sync_notification_delivery_available_at() is
  'Verplaatst nog niet verzonden prequeued deliveries atomisch mee wanneer een gepland notificatie-event wordt gerescheduled.';
