-- Guardrail: een notificatie-event mag uitsluitend naar een push-subscription
-- van dezelfde auth-gebruiker worden gekoppeld.
--
-- De notification-engine doet dit al correct applicatief. Deze trigger borgt
-- dezelfde invariant ook op databaseniveau voor toekomstige serverwrites.

create or replace function public.enforce_notification_delivery_same_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_user_id uuid;
  v_subscription_user_id uuid;
begin
  select e.user_id
    into v_event_user_id
  from public.notification_events e
  where e.id = new.notification_event_id;

  select s.user_id
    into v_subscription_user_id
  from public.push_subscriptions s
  where s.id = new.subscription_id;

  if v_event_user_id is null or v_subscription_user_id is null then
    raise exception 'notification delivery references missing event or subscription';
  end if;

  if v_event_user_id <> v_subscription_user_id then
    raise exception 'notification delivery user mismatch';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_notification_delivery_same_user() from public;
revoke all on function public.enforce_notification_delivery_same_user() from anon;
revoke all on function public.enforce_notification_delivery_same_user() from authenticated;
grant execute on function public.enforce_notification_delivery_same_user() to service_role;

drop trigger if exists trg_notification_delivery_same_user
  on public.notification_deliveries;

create trigger trg_notification_delivery_same_user
before insert or update of notification_event_id, subscription_id
on public.notification_deliveries
for each row
execute function public.enforce_notification_delivery_same_user();

comment on function public.enforce_notification_delivery_same_user() is
  'Database-invariant: notification_event.user_id moet gelijk zijn aan push_subscription.user_id.';
