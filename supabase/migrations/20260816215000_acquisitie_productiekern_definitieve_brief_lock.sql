-- ACQUISITIEPRODUCTIEKERN — DEFINTIEVE BRIEF DATABASEBREED IMMUTABLE
--
-- De bestaande UI schrijft legacy-concepten rechtstreeks naar off_market_brieven.
-- Zodra de Productiekern een brief definitief maakt, mag geen oud of nieuw
-- clientpad die rij daarna nog stil aanpassen. Printbatch/gepost-mutaties leven
-- op de versie-/batchtabellen en hebben geen UPDATE op deze briefrij nodig.

create or replace function public.off_market_bewaak_definitieve_brief_lock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'definitief' and new is distinct from old then
    raise exception 'brief_definitief_vergrendeld';
  end if;
  return new;
end;
$$;

revoke all on function public.off_market_bewaak_definitieve_brief_lock()
from public, anon, authenticated;

drop trigger if exists trg_off_market_brieven_definitieve_lock
on public.off_market_brieven;

create trigger trg_off_market_brieven_definitieve_lock
before update on public.off_market_brieven
for each row
execute function public.off_market_bewaak_definitieve_brief_lock();
