-- ACQUISITIEPRODUCTIEKERN — BESTAAND LEGACYCONCEPT TRANSACTIONEEL KOPPELEN
-- NIET AUTOMATISCH TOEPASSEN.
-- Review-only draft buiten supabase/migrations. Geen grants of activatie.
-- Deze draft eindigt expliciet met ROLLBACK.

begin;

create or replace function public.off_market_bestaand_concept_koppelen_intern(
  p_selectie_id uuid,
  p_brief_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz,
  p_inhoud_snapshot jsonb,
  p_geadresseerde_snapshot jsonb
)
returns table (
  brief_id uuid,
  signaal_id uuid,
  brief_versie_id uuid,
  versienummer integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signaal_id uuid;
  v_brief_signaal_id uuid;
  v_brief_status text;
  v_brief_archived_at timestamptz;
  v_brief_selectie_id uuid;
  v_actieve_versie integer;
  v_versie_id uuid;
  v_bestaand_event public.off_market_productie_events%rowtype;
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'operation_key_verplicht';
  end if;
  if jsonb_typeof(p_inhoud_snapshot) <> 'object' then
    raise exception 'inhoud_snapshot_verplicht';
  end if;
  if nullif(trim(p_inhoud_snapshot->>'brieftekst'), '') is null then
    raise exception 'brieftekst_verplicht';
  end if;
  if jsonb_typeof(p_geadresseerde_snapshot) <> 'object' then
    raise exception 'geadresseerde_snapshot_verplicht';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  select e.* into v_bestaand_event
  from public.off_market_productie_events e
  where e.operation_key = p_operation_key;

  if found then
    if v_bestaand_event.event_type <> 'briefversie_aangemaakt'
      or v_bestaand_event.brief_id is distinct from p_brief_id
      or v_bestaand_event.metadata->>'bron' is distinct from 'bestaand_concept_bridge'
      or v_bestaand_event.brief_versie_id is null
      or nullif(v_bestaand_event.metadata->>'versienummer', '') is null then
      raise exception 'operation_key_conflict';
    end if;

    return query
      select
        v_bestaand_event.brief_id,
        v_bestaand_event.signaal_id,
        v_bestaand_event.brief_versie_id,
        (v_bestaand_event.metadata->>'versienummer')::integer;
    return;
  end if;

  select d.signaal_id into v_signaal_id
  from public.off_market_acquisitie_dossiers d
  where d.selectie_id = p_selectie_id
    and d.verwerking_gestart_op is not null
  for update;
  if not found then
    raise exception 'dossier_niet_gestart';
  end if;

  select
    b.signaal_id,
    b.status,
    b.archived_at,
    b.selectie_id,
    b.actieve_versie
  into
    v_brief_signaal_id,
    v_brief_status,
    v_brief_archived_at,
    v_brief_selectie_id,
    v_actieve_versie
  from public.off_market_brieven b
  where b.id = p_brief_id
  for update;

  if not found then
    raise exception 'brief_niet_gevonden';
  end if;
  if v_brief_archived_at is not null then
    raise exception 'brief_gearchiveerd';
  end if;
  if v_brief_status <> 'concept' then
    raise exception 'brief_niet_concept';
  end if;
  if v_brief_signaal_id is distinct from v_signaal_id then
    raise exception 'brief_signaal_mismatch';
  end if;
  if v_brief_selectie_id is not null and v_brief_selectie_id <> p_selectie_id then
    raise exception 'brief_al_aan_andere_selectie_gekoppeld';
  end if;
  if v_actieve_versie is not null
    or exists (
      select 1
      from public.off_market_brief_versies v
      where v.brief_id = p_brief_id
    ) then
    raise exception 'brief_reeds_productiekern_gekoppeld';
  end if;

  v_versie_id := gen_random_uuid();

  insert into public.off_market_brief_versies (
    id,
    brief_id,
    versienummer,
    status,
    inhoud_snapshot,
    geadresseerde_snapshot,
    aangemaakt_door,
    created_at
  ) values (
    v_versie_id,
    p_brief_id,
    1,
    'actief',
    p_inhoud_snapshot,
    p_geadresseerde_snapshot,
    p_actor_id,
    p_uitgevoerd_op
  );

  update public.off_market_brieven
  set selectie_id = p_selectie_id,
      actieve_versie = 1,
      updated_at = p_uitgevoerd_op
  where id = p_brief_id;

  update public.off_market_acquisitie_dossiers
  set primaire_werkbak = 'brief_opstellen',
      updated_at = p_uitgevoerd_op
  where selectie_id = p_selectie_id;

  insert into public.off_market_productie_events (
    id,
    operation_key,
    event_type,
    signaal_id,
    selectie_id,
    brief_id,
    brief_versie_id,
    actor_id,
    event_at,
    metadata
  ) values (
    gen_random_uuid(),
    p_operation_key,
    'briefversie_aangemaakt',
    v_signaal_id,
    p_selectie_id,
    p_brief_id,
    v_versie_id,
    p_actor_id,
    p_uitgevoerd_op,
    jsonb_build_object(
      'versienummer', 1,
      'bron', 'bestaand_concept_bridge'
    )
  );

  return query select p_brief_id, v_signaal_id, v_versie_id, 1;
end;
$$;

revoke all on function public.off_market_bestaand_concept_koppelen_intern(
  uuid, uuid, uuid, text, timestamptz, jsonb, jsonb
) from public, anon, authenticated;

create or replace function public.off_market_bestaand_concept_koppelen(
  p_selectie_id uuid,
  p_brief_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz,
  p_inhoud_snapshot jsonb,
  p_geadresseerde_snapshot jsonb
)
returns table (
  brief_id uuid,
  signaal_id uuid,
  brief_versie_id uuid,
  versienummer integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);

  return query
    select *
    from public.off_market_bestaand_concept_koppelen_intern(
      p_selectie_id,
      p_brief_id,
      p_actor_id,
      p_operation_key,
      p_uitgevoerd_op,
      p_inhoud_snapshot,
      p_geadresseerde_snapshot
    );
end;
$$;

revoke all on function public.off_market_bestaand_concept_koppelen(
  uuid, uuid, uuid, text, timestamptz, jsonb, jsonb
) from public, anon, authenticated;

rollback;
