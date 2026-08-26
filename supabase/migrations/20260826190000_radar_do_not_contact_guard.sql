-- Harde Radar do-not-contact waarborg.
-- Een handmatig aangemaakte postbrief mag de campagneblokkade niet omzeilen.

create or replace function public.off_market_guard_radar_do_not_contact_brief()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocked boolean := false;
  v_recipient_key text;
begin
  if new.archived_at is not null or coalesce(new.kanaal, 'post') <> 'post' then
    return new;
  end if;

  v_recipient_key := nullif(trim(new.geadresseerde_key), '');

  if v_recipient_key is not null then
    select exists (
      select 1
      from public.eigenaren e
      join public.off_market_benadercampagnes c on c.eigenaar_id = e.id
      where e.archived_at is null
        and e.dedupe_sleutel = 'radar_geadresseerde:' || v_recipient_key
        and c.doelstelling = 'radar_acquisitie'
        and c.contact_status = 'do_not_contact'
    ) into v_blocked;
  else
    -- Alleen zonder geadresseerde_key mag een expliciete signaalkoppeling als
    -- fallback dienen, en uitsluitend als het signaal exact één partij heeft.
    select exists (
      select 1
      from public.eigenaar_koppelingen ek
      join public.off_market_benadercampagnes c on c.eigenaar_id = ek.eigenaar_id
      where ek.signaal_id = new.signaal_id
        and c.doelstelling = 'radar_acquisitie'
        and c.contact_status = 'do_not_contact'
        and 1 = (
          select count(distinct ek2.eigenaar_id)
          from public.eigenaar_koppelingen ek2
          where ek2.signaal_id = new.signaal_id
        )
    ) into v_blocked;
  end if;

  if v_blocked then
    raise exception using
      errcode = 'P0001',
      message = 'RADAR_DO_NOT_CONTACT: briefproductie is geblokkeerd voor deze partij';
  end if;

  return new;
end;
$$;

revoke all on function public.off_market_guard_radar_do_not_contact_brief() from public;

-- Idempotent trigger-installatie.
drop trigger if exists off_market_brieven_radar_do_not_contact_guard on public.off_market_brieven;
create trigger off_market_brieven_radar_do_not_contact_guard
before insert or update of signaal_id, geadresseerde_key, kanaal, status, archived_at
on public.off_market_brieven
for each row execute function public.off_market_guard_radar_do_not_contact_brief();

create or replace function public.off_market_override_do_not_contact(
  p_campagne_id uuid,
  p_nieuwe_contact_status text,
  p_reden text
)
returns public.off_market_benadercampagnes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.off_market_benadercampagnes;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.is_intern_gebruiker(v_actor) then
    raise exception using errcode = '42501', message = 'Niet bevoegd om do-not-contact op te heffen.';
  end if;
  if length(trim(coalesce(p_reden, ''))) < 5 then
    raise exception using errcode = '22023', message = 'Een concrete reden voor de override is verplicht.';
  end if;
  if p_nieuwe_contact_status not in ('cold','not_now','not_interested','warm') then
    raise exception using errcode = '22023', message = 'Ongeldige nieuwe contactstatus.';
  end if;

  select * into v_row
  from public.off_market_benadercampagnes
  where id = p_campagne_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Campagne niet gevonden.';
  end if;
  if v_row.contact_status <> 'do_not_contact' then
    raise exception using errcode = 'P0001', message = 'Campagne heeft geen actieve do-not-contact blokkade.';
  end if;

  update public.off_market_benadercampagnes
  set contact_status = p_nieuwe_contact_status,
      routing_reden = trim(p_reden),
      updated_at = now()
  where id = p_campagne_id
  returning * into v_row;

  insert into public.off_market_campagne_events (
    campagne_id, eigenaar_id, event_type, reden, metadata, aangemaakt_door
  ) values (
    v_row.id,
    v_row.eigenaar_id,
    'do_not_contact_override',
    trim(p_reden),
    jsonb_build_object('new_contact_status', p_nieuwe_contact_status),
    v_actor
  );

  return v_row;
end;
$$;

revoke all on function public.off_market_override_do_not_contact(uuid, text, text) from public;
grant execute on function public.off_market_override_do_not_contact(uuid, text, text) to authenticated;
