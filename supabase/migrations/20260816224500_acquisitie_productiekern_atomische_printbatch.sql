-- Acquisitie Productiekern — atomische BAT-start.
--
-- Een printbatch en alle gekoppelde immutable briefversies vormen één
-- productie-eenheid. De oudere losse RPC's blijven bestaan voor backwards
-- compatibility, maar de nieuwe UI gebruikt uitsluitend deze atomische route.

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
  v_gezien_brief_ids uuid[] := array[]::uuid[];
  v_gezien_versie_ids uuid[] := array[]::uuid[];
begin
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  if p_datum is null then raise exception 'batchdatum_verplicht'; end if;
  if jsonb_typeof(p_brieven) <> 'array' then raise exception 'brieven_array_verplicht'; end if;
  if jsonb_array_length(p_brieven) < 1 then raise exception 'minimaal_een_brief_verplicht'; end if;
  if jsonb_array_length(p_brieven) > 1000 then raise exception 'maximaal_1000_brieven_per_batch'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  if exists (
    select 1 from public.off_market_productie_events
    where operation_key = p_operation_key and event_type = 'batchnummer_uitgegeven'
  ) then
    return query
      select e.batch_id, e.metadata->>'batchnummer'
      from public.off_market_productie_events e
      where e.operation_key = p_operation_key
        and e.event_type = 'batchnummer_uitgegeven';
    return;
  end if;

  if exists (
    select 1 from public.off_market_productie_events
    where operation_key = p_operation_key
  ) then
    raise exception 'operation_key_conflict';
  end if;

  -- Valideer de volledige set vóór nummerreservering en vóór enige insert.
  for v_item in select value from jsonb_array_elements(p_brieven) loop
    begin
      v_brief_id := (v_item->>'brief_id')::uuid;
      v_versie_id := (v_item->>'brief_versie_id')::uuid;
    exception when others then
      raise exception 'ongeldige_brief_of_versie_id';
    end;

    if v_brief_id is null or v_versie_id is null then
      raise exception 'brief_en_versie_id_verplicht';
    end if;
    if v_brief_id = any(v_gezien_brief_ids) then raise exception 'brief_dubbel_in_batch'; end if;
    if v_versie_id = any(v_gezien_versie_ids) then raise exception 'briefversie_dubbel_in_batch'; end if;

    select b.status, b.actieve_versie
      into v_brief_status, v_actieve_versie
    from public.off_market_brieven b
    where b.id = v_brief_id
    for update;
    if not found then raise exception 'brief_niet_gevonden'; end if;
    if v_brief_status <> 'definitief' then raise exception 'brief_niet_definitief'; end if;

    select bv.versienummer
      into v_versienummer
    from public.off_market_brief_versies bv
    where bv.id = v_versie_id
      and bv.brief_id = v_brief_id
      and bv.status = 'actief'
    for update;
    if not found then raise exception 'actieve_briefversie_niet_gevonden'; end if;
    if v_actieve_versie is distinct from v_versienummer then raise exception 'briefversie_drift'; end if;

    -- Eén immutable versie mag door het bestaande unieke indexcontract niet in
    -- twee actieve batches tegelijk zitten. Expliciet controleren geeft een
    -- begrijpelijke fout vóór de batch wordt aangemaakt.
    if exists (
      select 1 from public.off_market_printbatch_brieven pb
      where pb.brief_versie_id = v_versie_id and pb.verwijderd_op is null
    ) then
      raise exception 'briefversie_reeds_in_actieve_batch';
    end if;

    v_gezien_brief_ids := array_append(v_gezien_brief_ids, v_brief_id);
    v_gezien_versie_ids := array_append(v_gezien_versie_ids, v_versie_id);
  end loop;

  v_batchnummer := public.reserveer_off_market_batchnummer(p_datum);
  v_batch_id := gen_random_uuid();

  insert into public.off_market_printbatches(
    id, batchnummer, status, documentversie, aangemaakt_door, created_at
  ) values (
    v_batch_id, v_batchnummer, 'concept', 1, p_actor_id, p_uitgevoerd_op
  );

  insert into public.off_market_productie_events(
    id, operation_key, event_type, batch_id, actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'batchnummer_uitgegeven', v_batch_id,
    p_actor_id, p_uitgevoerd_op,
    jsonb_build_object('batchnummer', v_batchnummer, 'brief_aantal', jsonb_array_length(p_brieven))
  );

  for v_item in select value from jsonb_array_elements(p_brieven) loop
    v_brief_id := (v_item->>'brief_id')::uuid;
    v_versie_id := (v_item->>'brief_versie_id')::uuid;

    insert into public.off_market_printbatch_brieven(
      id, batch_id, brief_id, brief_versie_id, toegevoegd_door, created_at
    ) values (
      gen_random_uuid(), v_batch_id, v_brief_id, v_versie_id, p_actor_id, p_uitgevoerd_op
    );

    insert into public.off_market_productie_events(
      id, operation_key, event_type, brief_id, brief_versie_id,
      batch_id, actor_id, event_at
    ) values (
      gen_random_uuid(), p_operation_key || ':brief:' || v_versie_id::text,
      'brief_aan_batch_toegevoegd', v_brief_id, v_versie_id,
      v_batch_id, p_actor_id, p_uitgevoerd_op
    );
  end loop;

  return query select v_batch_id, v_batchnummer;
end;
$$;

revoke all on function public.off_market_printbatch_met_brieven_aanmaken_intern(uuid,text,timestamptz,date,jsonb)
  from public, anon, authenticated;

create or replace function public.off_market_printbatch_met_brieven_aanmaken(
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
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  return query
    select * from public.off_market_printbatch_met_brieven_aanmaken_intern(
      p_actor_id, p_operation_key, p_uitgevoerd_op, p_datum, p_brieven
    );
end;
$$;

revoke all on function public.off_market_printbatch_met_brieven_aanmaken(uuid,text,timestamptz,date,jsonb)
  from public, anon;
grant execute on function public.off_market_printbatch_met_brieven_aanmaken(uuid,text,timestamptz,date,jsonb)
  to authenticated;

-- Geen directe tabelwrites worden door deze migratie geopend.
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatches from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatch_brieven from authenticated;
