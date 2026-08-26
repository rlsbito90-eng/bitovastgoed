-- Radar partij/campagne: harde laatste veiligheidsgrens voor losse brief-routes.
--
-- De UI hoort nieuwe koude post eerst via de partij/campagnerouter te sturen.
-- Deze trigger voorkomt daarnaast dat een andere/legacy UI-route alsnog een
-- tweede Brief 1 kan vastleggen voor exact dezelfde sterke geadresseerde-
-- identiteit. Historische records worden niet gewijzigd.

create or replace function public.off_market_guard_duplicate_brief1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bestaand record;
begin
  if new.archived_at is not null
     or coalesce(new.kanaal, 'post') <> 'post'
     or new.campagne_stap is distinct from 'brief_1'
     or nullif(btrim(new.geadresseerde_key), '') is null then
    return new;
  end if;

  select
    b.id,
    b.signaal_id,
    b.status,
    b.campagne_stap,
    b.verzonden_op
  into v_bestaand
  from public.off_market_brieven b
  where b.archived_at is null
    and coalesce(b.kanaal, 'post') = 'post'
    and b.geadresseerde_key = new.geadresseerde_key
    and b.campagne_stap in ('brief_1', 'brief_2', 'brief_3')
    and (tg_op = 'INSERT' or b.id <> new.id)
    and (
      -- Een werkelijk verzonden campagnecontact is altijd leidend,
      -- ook wanneer het hetzelfde signaal betreft.
      b.status = 'verstuurd'
      -- Een actief concept/definitief Brief 1 bij een ander signaal betekent
      -- eveneens dat die partij al een koude campagne heeft lopen.
      or (
        b.signaal_id is distinct from new.signaal_id
        and b.status in ('concept', 'definitief')
        and b.campagne_stap = 'brief_1'
      )
    )
  order by
    case when b.status = 'verstuurd' then 0 else 1 end,
    coalesce(b.verzonden_op, b.updated_at, b.created_at) desc
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = 'Geen nieuwe Brief 1: deze partij/geadresseerde heeft al een bestaande Radar-campagne of verzonden brief. Gebruik Radar-brieven om de juiste campagnestap of context te bepalen.',
      detail = format(
        'bestaande_brief_id=%s; bestaand_signaal_id=%s; status=%s; stap=%s',
        v_bestaand.id,
        v_bestaand.signaal_id,
        v_bestaand.status,
        v_bestaand.campagne_stap
      ),
      hint = 'Open Off-Market Radar > Acquisitieselectie > Radar-brieven; start niet opnieuw bij Brief 1.';
  end if;

  return new;
end;
$$;

revoke all on function public.off_market_guard_duplicate_brief1() from public;
grant execute on function public.off_market_guard_duplicate_brief1() to authenticated;

-- Alleen toekomstige inserts/inhoudelijke updates; bestaande historie blijft
-- volledig immutable en wordt niet door de migratie herschreven.
drop trigger if exists trg_off_market_guard_duplicate_brief1 on public.off_market_brieven;
create trigger trg_off_market_guard_duplicate_brief1
before insert or update of campagne_stap, geadresseerde_key, signaal_id, kanaal, archived_at
on public.off_market_brieven
for each row
execute function public.off_market_guard_duplicate_brief1();

comment on function public.off_market_guard_duplicate_brief1() is
  'Fail-safe: voorkomt een tweede koude Brief 1 voor dezelfde sterke geadresseerde-identiteit buiten de canonieke Radar-campagnerouter.';
