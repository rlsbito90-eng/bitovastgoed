-- Expliciete, atomische hoofdobjectwissel voor een Radar-campagne.
-- Nooit automatisch: alleen via een bevoegde gebruikersactie met reden.

create or replace function public.off_market_set_primary_object(
  p_campagne_id uuid,
  p_signaal_id uuid,
  p_reden text
)
returns public.off_market_campagne_objecten
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.off_market_campagne_objecten;
  v_old public.off_market_campagne_objecten;
  v_owner_id uuid;
begin
  if v_actor is null or not public.is_intern_gebruiker(v_actor) then
    raise exception using errcode = '42501', message = 'Niet bevoegd om het hoofdobject te wijzigen.';
  end if;
  if length(trim(coalesce(p_reden, ''))) < 5 then
    raise exception using errcode = '22023', message = 'Een concrete reden voor de hoofdobjectwissel is verplicht.';
  end if;

  select eigenaar_id into v_owner_id
  from public.off_market_benadercampagnes
  where id = p_campagne_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Campagne niet gevonden.';
  end if;

  select * into v_target
  from public.off_market_campagne_objecten
  where campagne_id = p_campagne_id and signaal_id = p_signaal_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Het voorgestelde object is niet aan deze campagne gekoppeld.';
  end if;

  if v_target.rol = 'primary' then
    return v_target;
  end if;

  select * into v_old
  from public.off_market_campagne_objecten
  where campagne_id = p_campagne_id and rol = 'primary'
  for update;

  if found then
    update public.off_market_campagne_objecten
    set rol = 'context',
        reden_toevoeging = coalesce(reden_toevoeging, '') || case when coalesce(reden_toevoeging, '') = '' then '' else ' · ' end || 'Voormalig hoofdobject; handmatig vervangen.',
        updated_at = now()
    where id = v_old.id;
  end if;

  update public.off_market_campagne_objecten
  set rol = 'primary',
      noemen_in_volgend_contact = true,
      updated_at = now()
  where id = v_target.id
  returning * into v_target;

  insert into public.off_market_campagne_events (
    campagne_id, eigenaar_id, signaal_id, event_type, reden, metadata, aangemaakt_door
  ) values (
    p_campagne_id,
    v_owner_id,
    p_signaal_id,
    'primary_object_changed',
    trim(p_reden),
    jsonb_build_object(
      'old_signaal_id', case when v_old.id is null then null else v_old.signaal_id end,
      'new_signaal_id', p_signaal_id
    ),
    v_actor
  );

  return v_target;
end;
$$;

revoke all on function public.off_market_set_primary_object(uuid, uuid, text) from public;
grant execute on function public.off_market_set_primary_object(uuid, uuid, text) to authenticated;
