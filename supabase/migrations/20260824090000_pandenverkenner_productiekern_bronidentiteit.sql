-- Pandenverkenner / Vastgoedkansen naar dezelfde acquisitie-productiekern.
--
-- Principes:
-- 1. BR- en BAT-nummerreeksen blijven globaal gedeeld.
-- 2. Elk dossier / elke brief verwijst naar exact één bron: Radar-signaal OF Vastgoedkans.
-- 3. Een printbatch bevat uitsluitend brieven uit één bronfamilie.
-- 4. Kadaster blijft buiten deze migratie en blijft expliciet/handmatig.

alter table public.off_market_acquisitie_dossiers
  add column if not exists vastgoedkans_id uuid null references public.vastgoedkansen(id) on delete cascade;

alter table public.off_market_acquisitie_dossiers
  alter column signaal_id drop not null;

alter table public.off_market_acquisitie_dossiers
  drop constraint if exists off_market_acquisitie_dossiers_exact_een_bron;
alter table public.off_market_acquisitie_dossiers
  add constraint off_market_acquisitie_dossiers_exact_een_bron
  check (num_nonnulls(signaal_id, vastgoedkans_id) = 1) not valid;
alter table public.off_market_acquisitie_dossiers
  validate constraint off_market_acquisitie_dossiers_exact_een_bron;

create index if not exists off_market_acquisitie_dossiers_vastgoedkans_idx
  on public.off_market_acquisitie_dossiers(vastgoedkans_id)
  where vastgoedkans_id is not null;

alter table public.off_market_productie_events
  add column if not exists vastgoedkans_id uuid null references public.vastgoedkansen(id) on delete set null;

alter table public.off_market_productie_events
  drop constraint if exists off_market_productie_events_max_een_dossierbron;
alter table public.off_market_productie_events
  add constraint off_market_productie_events_max_een_dossierbron
  check (num_nonnulls(signaal_id, vastgoedkans_id) <= 1) not valid;
alter table public.off_market_productie_events
  validate constraint off_market_productie_events_max_een_dossierbron;

create index if not exists off_market_productie_events_vastgoedkans_idx
  on public.off_market_productie_events(vastgoedkans_id, event_at desc)
  where vastgoedkans_id is not null;

alter table public.off_market_printbatches
  add column if not exists bron_type text;

update public.off_market_printbatches
set bron_type = 'off_market_radar'
where bron_type is null;

alter table public.off_market_printbatches
  alter column bron_type set default 'off_market_radar';
alter table public.off_market_printbatches
  alter column bron_type set not null;
alter table public.off_market_printbatches
  drop constraint if exists off_market_printbatches_bron_type_chk;
alter table public.off_market_printbatches
  add constraint off_market_printbatches_bron_type_chk
  check (bron_type in ('off_market_radar', 'pandenverkenner'));

create index if not exists off_market_printbatches_bron_created_idx
  on public.off_market_printbatches(bron_type, created_at desc);

-- Bron-neutrale dossierstart. De bestaande Radar-RPC blijft behouden voor
-- backwards compatibility; nieuwe adapters kunnen deze V2 gebruiken.
create or replace function public.acquisitie_verwerking_starten_v2(
  p_selectie_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz
)
returns table (
  selectie_id uuid,
  signaal_id uuid,
  vastgoedkans_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signaal_id uuid;
  v_vastgoedkans_id uuid;
  v_object_id uuid;
  v_startwerkbak text;
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  if exists(select 1 from public.off_market_productie_events where operation_key = p_operation_key) then
    return query
      select e.selectie_id, e.signaal_id, e.vastgoedkans_id
      from public.off_market_productie_events e
      where e.operation_key = p_operation_key;
    return;
  end if;

  select s.signaal_id, s.vastgoedkans_id
    into v_signaal_id, v_vastgoedkans_id
  from public.off_market_acquisitie_selectie s
  where s.id = p_selectie_id and s.archived_at is null;
  if not found then raise exception 'selectie_niet_gevonden'; end if;
  if num_nonnulls(v_signaal_id, v_vastgoedkans_id) <> 1 then raise exception 'selectie_bron_ongeldig'; end if;

  if v_vastgoedkans_id is not null then
    select k.object_id into v_object_id from public.vastgoedkansen k where k.id = v_vastgoedkans_id;
    -- Pandenverkenner mag zonder Kadaster direct naar briefopstelling als het
    -- objectadres wordt gebruikt. De operationele UI bepaalt daarna de precieze readiness.
    v_startwerkbak := 'brief_opstellen';
  else
    select s.object_id into v_object_id from public.off_market_signalen s where s.id = v_signaal_id;
    v_startwerkbak := 'eigenaar_achterhalen';
  end if;

  insert into public.off_market_acquisitie_dossiers(
    id, selectie_id, signaal_id, vastgoedkans_id, object_id,
    verwerking_gestart_op, verwerking_gestart_door, primaire_werkbak,
    created_at, updated_at
  ) values (
    gen_random_uuid(), p_selectie_id, v_signaal_id, v_vastgoedkans_id, v_object_id,
    p_uitgevoerd_op, p_actor_id, v_startwerkbak,
    p_uitgevoerd_op, p_uitgevoerd_op
  )
  on conflict on constraint off_market_acquisitie_dossiers_selectie_uq do update set
    verwerking_gestart_op = coalesce(public.off_market_acquisitie_dossiers.verwerking_gestart_op, excluded.verwerking_gestart_op),
    verwerking_gestart_door = coalesce(public.off_market_acquisitie_dossiers.verwerking_gestart_door, excluded.verwerking_gestart_door),
    primaire_werkbak = case
      when public.off_market_acquisitie_dossiers.primaire_werkbak = 'nieuwe_selectie' then excluded.primaire_werkbak
      else public.off_market_acquisitie_dossiers.primaire_werkbak
    end,
    object_id = coalesce(public.off_market_acquisitie_dossiers.object_id, excluded.object_id),
    updated_at = excluded.updated_at;

  insert into public.off_market_productie_events(
    id, operation_key, event_type, signaal_id, vastgoedkans_id,
    selectie_id, actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'verwerking_gestart',
    v_signaal_id, v_vastgoedkans_id, p_selectie_id, p_actor_id, p_uitgevoerd_op,
    jsonb_build_object('bron', case when v_vastgoedkans_id is null then 'off_market_radar' else 'pandenverkenner' end)
  );

  return query select p_selectie_id, v_signaal_id, v_vastgoedkans_id;
end;
$$;

revoke all on function public.acquisitie_verwerking_starten_v2(uuid,uuid,text,timestamptz)
  from public, anon;
grant execute on function public.acquisitie_verwerking_starten_v2(uuid,uuid,text,timestamptz)
  to authenticated;

-- Bron-neutrale bridge voor reeds bestaande conceptbrieven (Radar én Vastgoedkans).
create or replace function public.acquisitie_bestaand_concept_koppelen_v2(
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
  vastgoedkans_id uuid,
  brief_versie_id uuid,
  versienummer integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signaal_id uuid;
  v_vastgoedkans_id uuid;
  v_brief_signaal_id uuid;
  v_brief_vastgoedkans_id uuid;
  v_brief_status text;
  v_brief_archived_at timestamptz;
  v_brief_selectie_id uuid;
  v_actieve_versie integer;
  v_versie_id uuid;
  v_bestaand_event public.off_market_productie_events%rowtype;
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  if jsonb_typeof(p_inhoud_snapshot) <> 'object' then raise exception 'inhoud_snapshot_verplicht'; end if;
  if nullif(trim(p_inhoud_snapshot->>'brieftekst'), '') is null then raise exception 'brieftekst_verplicht'; end if;
  if jsonb_typeof(p_geadresseerde_snapshot) <> 'object' then raise exception 'geadresseerde_snapshot_verplicht'; end if;
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  select e.* into v_bestaand_event
  from public.off_market_productie_events e
  where e.operation_key = p_operation_key;
  if found then
    if v_bestaand_event.event_type <> 'briefversie_aangemaakt'
      or v_bestaand_event.brief_id is distinct from p_brief_id
      or v_bestaand_event.brief_versie_id is null
      or nullif(v_bestaand_event.metadata->>'versienummer', '') is null then
      raise exception 'operation_key_conflict';
    end if;
    return query select
      v_bestaand_event.brief_id,
      v_bestaand_event.signaal_id,
      v_bestaand_event.vastgoedkans_id,
      v_bestaand_event.brief_versie_id,
      (v_bestaand_event.metadata->>'versienummer')::integer;
    return;
  end if;

  select d.signaal_id, d.vastgoedkans_id
    into v_signaal_id, v_vastgoedkans_id
  from public.off_market_acquisitie_dossiers d
  where d.selectie_id = p_selectie_id and d.verwerking_gestart_op is not null
  for update;
  if not found then raise exception 'dossier_niet_gestart'; end if;
  if num_nonnulls(v_signaal_id, v_vastgoedkans_id) <> 1 then raise exception 'dossier_bron_ongeldig'; end if;

  select b.signaal_id, b.vastgoedkans_id, b.status, b.archived_at, b.selectie_id, b.actieve_versie
    into v_brief_signaal_id, v_brief_vastgoedkans_id, v_brief_status, v_brief_archived_at, v_brief_selectie_id, v_actieve_versie
  from public.off_market_brieven b
  where b.id = p_brief_id
  for update;
  if not found then raise exception 'brief_niet_gevonden'; end if;
  if v_brief_archived_at is not null then raise exception 'brief_gearchiveerd'; end if;
  if v_brief_status <> 'concept' then raise exception 'brief_niet_concept'; end if;
  if v_brief_signaal_id is distinct from v_signaal_id or v_brief_vastgoedkans_id is distinct from v_vastgoedkans_id then
    raise exception 'brief_dossier_mismatch';
  end if;
  if v_brief_selectie_id is not null and v_brief_selectie_id <> p_selectie_id then
    raise exception 'brief_al_aan_andere_selectie_gekoppeld';
  end if;
  if v_actieve_versie is not null or exists(select 1 from public.off_market_brief_versies v where v.brief_id = p_brief_id) then
    raise exception 'brief_reeds_productiekern_gekoppeld';
  end if;

  v_versie_id := gen_random_uuid();
  insert into public.off_market_brief_versies(
    id, brief_id, versienummer, status, inhoud_snapshot, geadresseerde_snapshot,
    aangemaakt_door, created_at
  ) values (
    v_versie_id, p_brief_id, 1, 'actief', p_inhoud_snapshot, p_geadresseerde_snapshot,
    p_actor_id, p_uitgevoerd_op
  );

  update public.off_market_brieven
  set selectie_id = p_selectie_id, actieve_versie = 1, updated_at = p_uitgevoerd_op
  where id = p_brief_id;

  update public.off_market_acquisitie_dossiers
  set primaire_werkbak = 'brief_opstellen', updated_at = p_uitgevoerd_op
  where selectie_id = p_selectie_id;

  insert into public.off_market_productie_events(
    id, operation_key, event_type, signaal_id, vastgoedkans_id, selectie_id,
    brief_id, brief_versie_id, actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'briefversie_aangemaakt',
    v_signaal_id, v_vastgoedkans_id, p_selectie_id, p_brief_id, v_versie_id,
    p_actor_id, p_uitgevoerd_op,
    jsonb_build_object(
      'versienummer', 1,
      'bron', case when v_vastgoedkans_id is null then 'off_market_radar' else 'pandenverkenner' end,
      'bridge', 'bestaand_concept_v2'
    )
  );

  return query select p_brief_id, v_signaal_id, v_vastgoedkans_id, v_versie_id, 1;
end;
$$;

revoke all on function public.acquisitie_bestaand_concept_koppelen_v2(uuid,uuid,uuid,text,timestamptz,jsonb,jsonb)
  from public, anon;
grant execute on function public.acquisitie_bestaand_concept_koppelen_v2(uuid,uuid,uuid,text,timestamptz,jsonb,jsonb)
  to authenticated;

-- Verrijk definitief maken met dossierbron in de audittrail zonder het publieke
-- RPC-contract te wijzigen.
create or replace function public.off_market_brief_definitief_maken(
  p_brief_id uuid,p_brief_versie_id uuid,p_actor_id uuid,p_operation_key text,p_verwacht_versienummer integer,p_uitgevoerd_op timestamptz,p_jaar integer
)
returns table (brief_id uuid, briefnummer text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_briefnummer text;
  v_status text;
  v_bestaand_nummer text;
  v_versienummer integer;
  v_signaal_id uuid;
  v_vastgoedkans_id uuid;
  v_selectie_id uuid;
begin
  if nullif(trim(p_operation_key),'') is null then raise exception 'operation_key_verplicht'; end if;
  if p_verwacht_versienummer<1 then raise exception 'ongeldig_verwacht_versienummer'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key,0));
  if exists(select 1 from public.off_market_productie_events where operation_key=p_operation_key) then
    return query select e.brief_id,e.metadata->>'briefnummer' from public.off_market_productie_events e where e.operation_key=p_operation_key; return;
  end if;
  select b.status,b.briefnummer,b.signaal_id,b.vastgoedkans_id,b.selectie_id
    into v_status,v_bestaand_nummer,v_signaal_id,v_vastgoedkans_id,v_selectie_id
  from public.off_market_brieven b where b.id=p_brief_id for update;
  if not found then raise exception 'brief_niet_gevonden'; end if;
  if num_nonnulls(v_signaal_id,v_vastgoedkans_id)<>1 then raise exception 'brief_bron_ongeldig'; end if;
  if v_status is distinct from 'concept' then raise exception 'brief_niet_concept'; end if;
  if v_bestaand_nummer is not null then raise exception 'briefnummer_bestaat_al'; end if;
  select v.versienummer into v_versienummer from public.off_market_brief_versies v where v.id=p_brief_versie_id and v.brief_id=p_brief_id and v.status='actief' for update;
  if not found then raise exception 'actieve_briefversie_niet_gevonden'; end if;
  if v_versienummer<>p_verwacht_versienummer then raise exception 'optimistic_lock_conflict'; end if;
  v_briefnummer:=public.reserveer_off_market_briefnummer(p_jaar);
  update public.off_market_brieven set briefnummer=v_briefnummer,status='definitief',definitief_op=p_uitgevoerd_op,vergrendeld_op=p_uitgevoerd_op where id=p_brief_id;
  insert into public.off_market_productie_events(
    id,operation_key,event_type,signaal_id,vastgoedkans_id,selectie_id,brief_id,brief_versie_id,actor_id,event_at,metadata
  ) values(
    gen_random_uuid(),p_operation_key,'briefnummer_uitgegeven',v_signaal_id,v_vastgoedkans_id,v_selectie_id,p_brief_id,p_brief_versie_id,p_actor_id,p_uitgevoerd_op,
    jsonb_build_object('briefnummer',v_briefnummer,'versienummer',v_versienummer,'bron',case when v_vastgoedkans_id is null then 'off_market_radar' else 'pandenverkenner' end)
  );
  return query select p_brief_id,v_briefnummer;
end; $$;

-- Atomische BAT-start: bron wordt uit de brieven afgeleid en gemengde batches
-- worden hard geweigerd. Het bestaande RPC-signatuur blijft gelijk.
create or replace function public.off_market_printbatch_met_brieven_aanmaken_intern(
  p_actor_id uuid,
  p_operation_key text,
  p_uitgevoerd_op timestamptz,
  p_datum date,
  p_brieven jsonb
)
returns table(batch_id uuid, batchnummer text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid;
  v_batchnummer text;
  v_item jsonb;
  v_brief_id uuid;
  v_versie_id uuid;
  v_brief_status text;
  v_actieve_versie integer;
  v_versienummer integer;
  v_signaal_id uuid;
  v_vastgoedkans_id uuid;
  v_item_bron text;
  v_batch_bron text := null;
  v_gezien_brief_ids uuid[] := array[]::uuid[];
  v_gezien_versie_ids uuid[] := array[]::uuid[];
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  if p_datum is null then raise exception 'batchdatum_verplicht'; end if;
  if jsonb_typeof(p_brieven) <> 'array' then raise exception 'brieven_array_verplicht'; end if;
  if jsonb_array_length(p_brieven) < 1 then raise exception 'minimaal_een_brief_verplicht'; end if;
  if jsonb_array_length(p_brieven) > 1000 then raise exception 'maximaal_1000_brieven_per_batch'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  if exists(select 1 from public.off_market_productie_events where operation_key = p_operation_key and event_type = 'batchnummer_uitgegeven') then
    return query select e.batch_id, e.metadata->>'batchnummer' from public.off_market_productie_events e where e.operation_key = p_operation_key and e.event_type = 'batchnummer_uitgegeven';
    return;
  end if;
  if exists(select 1 from public.off_market_productie_events where operation_key = p_operation_key) then raise exception 'operation_key_conflict'; end if;

  for v_item in select value from jsonb_array_elements(p_brieven) loop
    begin
      v_brief_id := (v_item->>'brief_id')::uuid;
      v_versie_id := (v_item->>'brief_versie_id')::uuid;
    exception when others then
      raise exception 'ongeldige_brief_of_versie_id';
    end;
    if v_brief_id is null or v_versie_id is null then raise exception 'brief_en_versie_id_verplicht'; end if;
    if v_brief_id = any(v_gezien_brief_ids) then raise exception 'brief_dubbel_in_batch'; end if;
    if v_versie_id = any(v_gezien_versie_ids) then raise exception 'briefversie_dubbel_in_batch'; end if;

    select b.status,b.actieve_versie,b.signaal_id,b.vastgoedkans_id
      into v_brief_status,v_actieve_versie,v_signaal_id,v_vastgoedkans_id
    from public.off_market_brieven b where b.id=v_brief_id for update;
    if not found then raise exception 'brief_niet_gevonden'; end if;
    if v_brief_status<>'definitief' then raise exception 'brief_niet_definitief'; end if;
    if num_nonnulls(v_signaal_id,v_vastgoedkans_id)<>1 then raise exception 'brief_bron_ongeldig'; end if;

    v_item_bron := case when v_vastgoedkans_id is null then 'off_market_radar' else 'pandenverkenner' end;
    if v_batch_bron is null then v_batch_bron := v_item_bron;
    elsif v_batch_bron <> v_item_bron then raise exception 'gemengde_bronnen_in_batch_niet_toegestaan';
    end if;

    select bv.versienummer into v_versienummer
    from public.off_market_brief_versies bv
    where bv.id=v_versie_id and bv.brief_id=v_brief_id and bv.status='actief'
    for update;
    if not found then raise exception 'actieve_briefversie_niet_gevonden'; end if;
    if v_actieve_versie is distinct from v_versienummer then raise exception 'briefversie_drift'; end if;
    if exists(select 1 from public.off_market_printbatch_brieven pb where pb.brief_versie_id=v_versie_id and pb.verwijderd_op is null) then raise exception 'briefversie_reeds_in_actieve_batch'; end if;

    v_gezien_brief_ids:=array_append(v_gezien_brief_ids,v_brief_id);
    v_gezien_versie_ids:=array_append(v_gezien_versie_ids,v_versie_id);
  end loop;

  v_batchnummer:=public.reserveer_off_market_batchnummer(p_datum);
  v_batch_id:=gen_random_uuid();
  insert into public.off_market_printbatches(id,batchnummer,status,documentversie,bron_type,aangemaakt_door,created_at)
  values(v_batch_id,v_batchnummer,'concept',1,v_batch_bron,p_actor_id,p_uitgevoerd_op);

  insert into public.off_market_productie_events(id,operation_key,event_type,batch_id,actor_id,event_at,metadata)
  values(gen_random_uuid(),p_operation_key,'batchnummer_uitgegeven',v_batch_id,p_actor_id,p_uitgevoerd_op,
    jsonb_build_object('batchnummer',v_batchnummer,'brief_aantal',jsonb_array_length(p_brieven),'bron',v_batch_bron));

  for v_item in select value from jsonb_array_elements(p_brieven) loop
    v_brief_id := (v_item->>'brief_id')::uuid;
    v_versie_id := (v_item->>'brief_versie_id')::uuid;
    select b.signaal_id,b.vastgoedkans_id into v_signaal_id,v_vastgoedkans_id from public.off_market_brieven b where b.id=v_brief_id;

    insert into public.off_market_printbatch_brieven(id,batch_id,brief_id,brief_versie_id,toegevoegd_door,created_at)
    values(gen_random_uuid(),v_batch_id,v_brief_id,v_versie_id,p_actor_id,p_uitgevoerd_op);

    insert into public.off_market_productie_events(
      id,operation_key,event_type,signaal_id,vastgoedkans_id,brief_id,brief_versie_id,batch_id,actor_id,event_at,metadata
    ) values(
      gen_random_uuid(),p_operation_key||':brief:'||v_versie_id::text,'brief_aan_batch_toegevoegd',
      v_signaal_id,v_vastgoedkans_id,v_brief_id,v_versie_id,v_batch_id,p_actor_id,p_uitgevoerd_op,
      jsonb_build_object('bron',v_batch_bron)
    );
  end loop;

  return query select v_batch_id,v_batchnummer;
end;
$$;

-- Ook postregistratie houdt de dossierbron vast in de audittrail.
create or replace function public.off_market_brief_gepost_markeren(
  p_brief_id uuid,p_brief_versie_id uuid,p_batch_id uuid,p_geadresseerde_key text,p_actor_id uuid,p_operation_key text,p_verwacht_versienummer integer,p_verzenddatum timestamptz
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_briefstatus text;
  v_versienummer integer;
  v_batchstatus text;
  v_printdatum timestamptz;
  v_openstaand integer;
  v_signaal_id uuid;
  v_vastgoedkans_id uuid;
begin
  if nullif(trim(p_geadresseerde_key),'') is null then raise exception 'geadresseerde_key_verplicht'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key,0));
  if exists(select 1 from public.off_market_productie_events where operation_key=p_operation_key) then return; end if;
  select status,signaal_id,vastgoedkans_id into v_briefstatus,v_signaal_id,v_vastgoedkans_id from public.off_market_brieven where id=p_brief_id for update;
  if not found then raise exception 'brief_niet_gevonden'; end if;
  if v_briefstatus<>'definitief' then raise exception 'brief_niet_definitief'; end if;
  if num_nonnulls(v_signaal_id,v_vastgoedkans_id)<>1 then raise exception 'brief_bron_ongeldig'; end if;
  select versienummer into v_versienummer from public.off_market_brief_versies where id=p_brief_versie_id and brief_id=p_brief_id and status='actief' for update;
  if not found then raise exception 'actieve_briefversie_niet_gevonden'; end if;
  if v_versienummer<>p_verwacht_versienummer then raise exception 'optimistic_lock_conflict'; end if;
  select status,printdatum into v_batchstatus,v_printdatum from public.off_market_printbatches where id=p_batch_id for update;
  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_batchstatus not in ('geprint','gedeeltelijk_gepost') or v_printdatum is null then raise exception 'batch_niet_geprint'; end if;
  if not exists(select 1 from public.off_market_printbatch_brieven where batch_id=p_batch_id and brief_id=p_brief_id and brief_versie_id=p_brief_versie_id and verwijderd_op is null) then raise exception 'briefversie_niet_in_batch'; end if;
  update public.off_market_brief_versies set status='verzonden',verzonden_op=p_verzenddatum where id=p_brief_versie_id;
  insert into public.off_market_productie_events(
    id,operation_key,event_type,signaal_id,vastgoedkans_id,brief_id,brief_versie_id,batch_id,actor_id,event_at,metadata
  ) values(
    gen_random_uuid(),p_operation_key,'brief_gepost',v_signaal_id,v_vastgoedkans_id,p_brief_id,p_brief_versie_id,p_batch_id,p_actor_id,p_verzenddatum,
    jsonb_build_object('geadresseerde_key',p_geadresseerde_key,'bron',case when v_vastgoedkans_id is null then 'off_market_radar' else 'pandenverkenner' end)
  );
  select count(*) into v_openstaand from public.off_market_printbatch_brieven pb join public.off_market_brief_versies bv on bv.id=pb.brief_versie_id where pb.batch_id=p_batch_id and pb.verwijderd_op is null and bv.status<>'verzonden';
  update public.off_market_printbatches set status=case when v_openstaand=0 then 'gepost' else 'gedeeltelijk_gepost' end,verzenddatum=p_verzenddatum where id=p_batch_id;
end; $$;

-- Schrijfpoorten blijven hetzelfde afgeschermd.
revoke all on function public.off_market_brief_definitief_maken(uuid,uuid,uuid,text,integer,timestamptz,integer) from public,anon;
grant execute on function public.off_market_brief_definitief_maken(uuid,uuid,uuid,text,integer,timestamptz,integer) to authenticated;
revoke all on function public.off_market_brief_gepost_markeren(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) from public,anon;
grant execute on function public.off_market_brief_gepost_markeren(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) to authenticated;
