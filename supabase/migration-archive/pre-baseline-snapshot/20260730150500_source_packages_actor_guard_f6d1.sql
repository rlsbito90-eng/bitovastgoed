-- Aanvullende Fase 6D.1 actor-guard.
-- Voorkomt dat een gewone geauthenticeerde client zichzelf als systeembeheerder
-- markeert of een andere gebruiker als beoordelaar opgeeft.

create or replace function public.vastgoedrekenen_enforce_bronpakket_actor()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
begin
  if new.system_managed and actor_id is not null then
    if tg_op = 'INSERT' or new.system_managed is distinct from old.system_managed then
      raise exception 'Alleen een systeemmigratie kan een systeembeheerd bronpakket aanmaken of instellen.';
    end if;
  end if;

  if new.status = 'goedgekeurd'
    and (tg_op = 'INSERT' or old.status is distinct from 'goedgekeurd')
    and not new.system_managed
  then
    if actor_id is null or new.goedgekeurd_door is distinct from actor_id then
      raise exception 'De vastgelegde beoordelaar moet gelijk zijn aan de aangemelde gebruiker.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists vastgoedrekenen_bronpakket_actor_guard on public.vastgoedrekenen_bronpakketten;
create trigger vastgoedrekenen_bronpakket_actor_guard
before insert or update on public.vastgoedrekenen_bronpakketten
for each row execute function public.vastgoedrekenen_enforce_bronpakket_actor();
