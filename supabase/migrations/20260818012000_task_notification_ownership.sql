-- Bito CRM — veilige ontvangersemantiek voor taaknotificaties
-- Additief en backward-compatible.

alter table public.taken
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create index if not exists taken_owner_user_open_idx
  on public.taken (owner_user_id, deadline)
  where soft_deleted_at is null
    and status not in ('afgerond', 'geannuleerd');

-- Nieuwe taken krijgen standaard de ingelogde gebruiker als eigenaar wanneer
-- de applicatie owner_user_id niet expliciet meegeeft.
create or replace function public.set_taak_owner_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is null and auth.uid() is not null then
    new.owner_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_taak_owner_user on public.taken;
create trigger trg_set_taak_owner_user
before insert on public.taken
for each row execute function public.set_taak_owner_user();

-- Veilige backfill voor de huidige single-user situatie: alleen als auth.users
-- exact één gebruiker bevat. Bij 0 of >1 gebruikers gebeurt bewust niets.
do $$
declare
  v_count integer;
  v_user_id uuid;
begin
  select count(*), min(id)
    into v_count, v_user_id
  from auth.users;

  if v_count = 1 then
    update public.taken
       set owner_user_id = v_user_id
     where owner_user_id is null;
  end if;
end $$;

comment on column public.taken.owner_user_id is
  'CRM-gebruiker die primair verantwoordelijk is voor de taak en taaknotificaties ontvangt.';
