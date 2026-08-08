-- BUILD A — VROEGE TRANSACTIONELE PRODUCTIEFUNCTIES
-- NIET AUTOMATISCH TOEPASSEN.
-- Reviewdraft buiten supabase/migrations. Geen productieactivatie of grants.

begin;

create or replace function public.off_market_verwerking_starten(
  p_selectie_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz
)
returns table (selectie_id uuid, signaal_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signaal_id uuid;
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  if exists (select 1 from public.off_market_productie_events where operation_key=p_operation_key) then
    return query select e.selectie_id, e.signaal_id from public.off_market_productie_events e where e.operation_key=p_operation_key;
    return;
  end if;

  select s.signaal_id into v_signaal_id
  from public.off_market_acquisitie_selectie s
  where s.id=p_selectie_id and s.archived_at is null;
  if not found then raise exception 'selectie_niet_gevonden'; end if;

  insert into public.off_market_acquisitie_dossiers (
    id, selectie_id, signaal_id, verwerking_gestart_op, verwerking_gestart_door,
    primaire_werkbak, created_at, updated_at
  ) values (
    gen_random_uuid(), p_selectie_id, v_signaal_id, p_uitgevoerd_op, p_actor_id,
    'eigenaar_achterhalen', p_uitgevoerd_op, p_uitgevoerd_op
  )
  on conflict (selectie_id) do update set
    verwerking_gestart_op = coalesce(public.off_market_acquisitie_dossiers.verwerking_gestart_op, excluded.verwerking_gestart_op),
    verwerking_gestart_door = coalesce(public.off_market_acquisitie_dossiers.verwerking_gestart_door, excluded.verwerking_gestart_door),
    primaire_werkbak = case when public.off_market_acquisitie_dossiers.primaire_werkbak='nieuwe_selectie' then 'eigenaar_achterhalen' else public.off_market_acquisitie_dossiers.primaire_werkbak end,
    updated_at = excluded.updated_at;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, signaal_id, selectie_id, actor_id, event_at
  ) values (
    gen_random_uuid(), p_operation_key, 'verwerking_gestart', v_signaal_id, p_selectie_id, p_actor_id, p_uitgevoerd_op
  );

  return query select p_selectie_id, v_signaal_id;
end;
$$;

create or replace function public.off_market_brief_reserveren(
  p_selectie_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz
)
returns table (brief_id uuid, signaal_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signaal_id uuid;
  v_brief_id uuid;
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));
  if exists (select 1 from public.off_market_productie_events where operation_key=p_operation_key) then
    return query select e.brief_id, e.signaal_id from public.off_market_productie_events e where e.operation_key=p_operation_key;
    return;
  end if;

  select d.signaal_id into v_signaal_id
  from public.off_market_acquisitie_dossiers d
  where d.selectie_id=p_selectie_id and d.verwerking_gestart_op is not null
  for update;
  if not found then raise exception 'dossier_niet_gestart'; end if;

  v_brief_id := gen_random_uuid();
  insert into public.off_market_brieven (id, signaal_id, brieftekst, status, selectie_id, created_at, updated_at)
  values (v_brief_id, v_signaal_id, '', 'concept', p_selectie_id, p_uitgevoerd_op, p_uitgevoerd_op);

  update public.off_market_acquisitie_dossiers
  set primaire_werkbak='brief_opstellen', updated_at=p_uitgevoerd_op
  where selectie_id=p_selectie_id;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, signaal_id, selectie_id, brief_id, actor_id, event_at
  ) values (
    gen_random_uuid(), p_operation_key, 'brief_aangemaakt', v_signaal_id, p_selectie_id, v_brief_id, p_actor_id, p_uitgevoerd_op
  );

  return query select v_brief_id, v_signaal_id;
end;
$$;

create or replace function public.off_market_briefversie_aanmaken(
  p_brief_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz,
  p_inhoud_snapshot jsonb,
  p_geadresseerde_snapshot jsonb
)
returns table (brief_versie_id uuid, versienummer integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_volgend integer;
  v_versie_id uuid;
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  if jsonb_typeof(p_inhoud_snapshot) <> 'object' then raise exception 'inhoud_snapshot_verplicht'; end if;
  if nullif(trim(p_inhoud_snapshot->>'brieftekst'), '') is null then raise exception 'brieftekst_verplicht'; end if;
  if jsonb_typeof(p_geadresseerde_snapshot) <> 'object' then raise exception 'geadresseerde_snapshot_verplicht'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));
  if exists (select 1 from public.off_market_productie_events where operation_key=p_operation_key) then
    return query select e.brief_versie_id, (e.metadata->>'versienummer')::integer from public.off_market_productie_events e where e.operation_key=p_operation_key;
    return;
  end if;

  select b.status into v_status from public.off_market_brieven b where b.id=p_brief_id for update;
  if not found then raise exception 'brief_niet_gevonden'; end if;
  if v_status <> 'concept' then raise exception 'brief_niet_concept'; end if;

  select coalesce(max(v.versienummer),0)+1 into v_volgend from public.off_market_brief_versies v where v.brief_id=p_brief_id;
  update public.off_market_brief_versies
  set status='vervallen', vervallen_op=p_uitgevoerd_op
  where brief_id=p_brief_id and status='actief';

  v_versie_id := gen_random_uuid();
  insert into public.off_market_brief_versies (
    id, brief_id, versienummer, status, inhoud_snapshot, geadresseerde_snapshot,
    aangemaakt_door, created_at
  ) values (
    v_versie_id, p_brief_id, v_volgend, 'actief', p_inhoud_snapshot,
    p_geadresseerde_snapshot, p_actor_id, p_uitgevoerd_op
  );

  update public.off_market_brieven
  set actieve_versie=v_volgend,
      brieftekst=p_inhoud_snapshot->>'brieftekst',
      onderwerp=p_inhoud_snapshot->>'onderwerp',
      objectadres=p_inhoud_snapshot->>'objectadres',
      objectomschrijving=p_inhoud_snapshot->>'objectomschrijving',
      aanhef=p_geadresseerde_snapshot->>'aanhef',
      eigenaar_naam=p_geadresseerde_snapshot->>'naam',
      eigenaar_bedrijfsnaam=p_geadresseerde_snapshot->>'bedrijfsnaam',
      updated_at=p_uitgevoerd_op
  where id=p_brief_id;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, brief_id, brief_versie_id, actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'briefversie_aangemaakt', p_brief_id,
    v_versie_id, p_actor_id, p_uitgevoerd_op, jsonb_build_object('versienummer',v_volgend)
  );

  return query select v_versie_id, v_volgend;
end;
$$;

create or replace function public.off_market_printbatch_aanmaken(
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz,
  p_datum date
)
returns table (batch_id uuid, batchnummer text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid;
  v_batchnummer text;
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));
  if exists (select 1 from public.off_market_productie_events where operation_key=p_operation_key) then
    return query select e.batch_id, e.metadata->>'batchnummer' from public.off_market_productie_events e where e.operation_key=p_operation_key;
    return;
  end if;

  v_batchnummer := public.reserveer_off_market_batchnummer(p_datum);
  v_batch_id := gen_random_uuid();
  insert into public.off_market_printbatches (id,batchnummer,status,documentversie,aangemaakt_door,created_at)
  values (v_batch_id,v_batchnummer,'concept',1,p_actor_id,p_uitgevoerd_op);

  insert into public.off_market_productie_events (
    id,operation_key,event_type,batch_id,actor_id,event_at,metadata
  ) values (
    gen_random_uuid(),p_operation_key,'batchnummer_uitgegeven',v_batch_id,p_actor_id,p_uitgevoerd_op,jsonb_build_object('batchnummer',v_batchnummer)
  );
  return query select v_batch_id,v_batchnummer;
end;
$$;

create or replace function public.off_market_briefversie_aan_batch_toevoegen(
  p_batch_id uuid,
  p_brief_id uuid,
  p_brief_versie_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_batchstatus text;
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key,0));
  if exists (select 1 from public.off_market_productie_events where operation_key=p_operation_key) then return; end if;

  select status into v_batchstatus from public.off_market_printbatches where id=p_batch_id for update;
  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_batchstatus <> 'concept' then raise exception 'batch_niet_wijzigbaar'; end if;
  if not exists (select 1 from public.off_market_brief_versies where id=p_brief_versie_id and brief_id=p_brief_id and status='actief') then
    raise exception 'actieve_briefversie_niet_gevonden';
  end if;

  insert into public.off_market_printbatch_brieven (id,batch_id,brief_id,brief_versie_id,toegevoegd_door,created_at)
  values (gen_random_uuid(),p_batch_id,p_brief_id,p_brief_versie_id,p_actor_id,p_uitgevoerd_op);

  insert into public.off_market_productie_events (
    id,operation_key,event_type,brief_id,brief_versie_id,batch_id,actor_id,event_at
  ) values (
    gen_random_uuid(),p_operation_key,'brief_aan_batch_toegevoegd',p_brief_id,p_brief_versie_id,p_batch_id,p_actor_id,p_uitgevoerd_op
  );
end;
$$;

revoke all on function public.off_market_verwerking_starten(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_reserveren(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aanmaken(uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.off_market_printbatch_aanmaken(uuid,text,timestamptz,date) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aan_batch_toevoegen(uuid,uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;

rollback;
