-- Bito CRM — garandeer notification_preferences voor iedere taakeigenaar.
-- Hierdoor werkt reminder_policy='default' ook als de gebruiker de notificatie-instellingen nog nooit heeft geopend.

insert into public.notification_preferences (user_id)
select distinct owner_user_id
from public.taken
where owner_user_id is not null
on conflict (user_id) do nothing;

create or replace function public.ensure_task_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is not null then
    insert into public.notification_preferences (user_id)
    values (new.owner_user_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_task_notification_preferences() from public, anon, authenticated;
grant execute on function public.ensure_task_notification_preferences() to service_role;

drop trigger if exists trg_zz_ensure_task_notification_preferences on public.taken;
create trigger trg_zz_ensure_task_notification_preferences
before insert or update of owner_user_id
on public.taken
for each row execute function public.ensure_task_notification_preferences();

comment on function public.ensure_task_notification_preferences() is
  'Garandeert server-side notification_preferences met DB-defaults voordat taakreminder-sync wordt uitgevoerd.';
