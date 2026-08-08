-- BUILD A — TRANSACTIONELE PRODUCTIEFUNCTIES
-- NIET AUTOMATISCH TOEPASSEN.
-- Dit bestand staat bewust buiten supabase/migrations.
-- Het is uitsluitend een reviewbaar functiecontract en mag pas na actuele
-- productie-DDL/RLS-verificatie en een groene geïsoleerde proef worden toegepast.

begin;

-- Alle functies blijven standaard onbereikbaar voor clientrollen.
-- Gerichte execute-grants worden pas in een afzonderlijk, goedgekeurd
-- activatiebesluit toegevoegd.

create or replace function public.off_market_brief_definitief_maken(
  p_brief_id uuid,
  p_brief_versie_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_verwacht_versienummer integer,
  p_uitgevoerd_op timestamptz,
  p_jaar integer
)
returns table (brief_id uuid, briefnummer text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_briefnummer text;
  v_status text;
  v_bestaand_nummer text;
  v_versienummer integer;
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'operation_key_verplicht';
  end if;
  if p_verwacht_versienummer < 1 then
    raise exception 'ongeldig_verwacht_versienummer';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  if exists (
    select 1 from public.off_market_productie_events
    where operation_key = p_operation_key
  ) then
    return query
      select e.brief_id, e.metadata->>'briefnummer'
      from public.off_market_productie_events e
      where e.operation_key = p_operation_key;
    return;
  end if;

  select b.status, b.briefnummer
    into v_status, v_bestaand_nummer
  from public.off_market_brieven b
  where b.id = p_brief_id
  for update;

  if not found then raise exception 'brief_niet_gevonden'; end if;
  if v_status is distinct from 'concept' then raise exception 'brief_niet_concept'; end if;
  if v_bestaand_nummer is not null then raise exception 'briefnummer_bestaat_al'; end if;

  select v.versienummer into v_versienummer
  from public.off_market_brief_versies v
  where v.id = p_brief_versie_id
    and v.brief_id = p_brief_id
    and v.status = 'actief'
  for update;

  if not found then raise exception 'actieve_briefversie_niet_gevonden'; end if;
  if v_versienummer <> p_verwacht_versienummer then
    raise exception 'optimistic_lock_conflict';
  end if;

  v_briefnummer := public.reserveer_off_market_briefnummer(p_jaar);

  update public.off_market_brieven
  set briefnummer = v_briefnummer,
      status = 'definitief',
      definitief_op = p_uitgevoerd_op,
      vergrendeld_op = p_uitgevoerd_op
  where id = p_brief_id;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, brief_id, brief_versie_id,
    actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'briefnummer_uitgegeven',
    p_brief_id, p_brief_versie_id, p_actor_id, p_uitgevoerd_op,
    jsonb_build_object('briefnummer', v_briefnummer, 'versienummer', v_versienummer)
  );

  return query select p_brief_id, v_briefnummer;
end;
$$;

create or replace function public.off_market_batch_documenten_registreren(
  p_batch_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_verwacht_documentversie integer,
  p_uitgevoerd_op timestamptz,
  p_documenten jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_documentversie integer;
  v_document jsonb;
  v_typen text[] := array[]::text[];
begin
  if jsonb_typeof(p_documenten) <> 'array' or jsonb_array_length(p_documenten) <> 4 then
    raise exception 'exact_vier_batchdocumenten_verplicht';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));
  if exists (select 1 from public.off_market_productie_events where operation_key = p_operation_key) then
    return;
  end if;

  select status, documentversie into v_status, v_documentversie
  from public.off_market_printbatches
  where id = p_batch_id
  for update;

  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_status not in ('concept', 'documenten_gegenereerd') then
    raise exception 'batchstatus_blokkeert_documentregistratie';
  end if;
  if v_documentversie <> p_verwacht_documentversie then
    raise exception 'optimistic_lock_conflict';
  end if;

  for v_document in select value from jsonb_array_elements(p_documenten)
  loop
    if (v_document->>'documenttype') not in
      ('brieven_pdf', 'adreslabels', 'controlelijst', 'batchvoorblad') then
      raise exception 'ongeldig_documenttype';
    end if;
    if nullif(trim(v_document->>'bestand_referentie'), '') is null then
      raise exception 'bestand_referentie_verplicht';
    end if;
    v_typen := array_append(v_typen, v_document->>'documenttype');
  end loop;

  if cardinality(array(select distinct unnest(v_typen))) <> 4 then
    raise exception 'ieder_documenttype_exact_een_keer_verplicht';
  end if;

  update public.off_market_batchdocumenten
  set status = 'vervallen', vervallen_op = p_uitgevoerd_op
  where batch_id = p_batch_id and status = 'actief';

  insert into public.off_market_batchdocumenten (
    id, batch_id, documentversie, documenttype, bestand_referentie,
    status, metadata, aangemaakt_door, created_at
  )
  select gen_random_uuid(), p_batch_id, p_verwacht_documentversie,
         d->>'documenttype', d->>'bestand_referentie', 'actief',
         coalesce(d->'metadata', '{}'::jsonb), p_actor_id, p_uitgevoerd_op
  from jsonb_array_elements(p_documenten) d;

  update public.off_market_printbatches
  set status = 'documenten_gegenereerd'
  where id = p_batch_id;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, batch_id, actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'documenten_gegenereerd',
    p_batch_id, p_actor_id, p_uitgevoerd_op,
    jsonb_build_object('documentversie', p_verwacht_documentversie)
  );
end;
$$;

create or replace function public.off_market_batch_geprint_markeren(
  p_batch_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_verwacht_documentversie integer,
  p_printdatum timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_documentversie integer;
  v_printdatum timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));
  if exists (select 1 from public.off_market_productie_events where operation_key = p_operation_key) then
    return;
  end if;

  select status, documentversie, printdatum
  into v_status, v_documentversie, v_printdatum
  from public.off_market_printbatches
  where id = p_batch_id
  for update;

  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_status <> 'documenten_gegenereerd' then raise exception 'batch_niet_printklaar'; end if;
  if v_printdatum is not null then raise exception 'printdatum_bestaat_al'; end if;
  if v_documentversie <> p_verwacht_documentversie then raise exception 'optimistic_lock_conflict'; end if;

  update public.off_market_printbatches
  set status = 'geprint', printdatum = p_printdatum
  where id = p_batch_id;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, batch_id, actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'batch_geprint',
    p_batch_id, p_actor_id, p_printdatum,
    jsonb_build_object('documentversie', p_verwacht_documentversie)
  );
end;
$$;

create or replace function public.off_market_brief_gepost_markeren(
  p_brief_id uuid,
  p_brief_versie_id uuid,
  p_batch_id uuid,
  p_geadresseerde_key text,
  p_actor_id uuid,
  p_operation_key text,
  p_verwacht_versienummer integer,
  p_verzenddatum timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_briefstatus text;
  v_versienummer integer;
  v_batchstatus text;
  v_printdatum timestamptz;
  v_openstaand integer;
begin
  if nullif(trim(p_geadresseerde_key), '') is null then
    raise exception 'geadresseerde_key_verplicht';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));
  if exists (select 1 from public.off_market_productie_events where operation_key = p_operation_key) then
    return;
  end if;

  select status into v_briefstatus
  from public.off_market_brieven where id = p_brief_id for update;
  if not found then raise exception 'brief_niet_gevonden'; end if;
  if v_briefstatus <> 'definitief' then raise exception 'brief_niet_definitief'; end if;

  select versienummer into v_versienummer
  from public.off_market_brief_versies
  where id = p_brief_versie_id and brief_id = p_brief_id and status = 'actief'
  for update;
  if not found then raise exception 'actieve_briefversie_niet_gevonden'; end if;
  if v_versienummer <> p_verwacht_versienummer then raise exception 'optimistic_lock_conflict'; end if;

  select status, printdatum into v_batchstatus, v_printdatum
  from public.off_market_printbatches where id = p_batch_id for update;
  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_batchstatus not in ('geprint', 'gedeeltelijk_gepost') or v_printdatum is null then
    raise exception 'batch_niet_geprint';
  end if;

  if not exists (
    select 1 from public.off_market_printbatch_brieven
    where batch_id = p_batch_id
      and brief_id = p_brief_id
      and brief_versie_id = p_brief_versie_id
      and verwijderd_op is null
  ) then
    raise exception 'briefversie_niet_in_batch';
  end if;

  update public.off_market_brief_versies
  set status = 'verzonden', verzonden_op = p_verzenddatum
  where id = p_brief_versie_id;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, brief_id, brief_versie_id, batch_id,
    actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'brief_gepost', p_brief_id,
    p_brief_versie_id, p_batch_id, p_actor_id, p_verzenddatum,
    jsonb_build_object('geadresseerde_key', p_geadresseerde_key)
  );

  select count(*) into v_openstaand
  from public.off_market_printbatch_brieven pb
  join public.off_market_brief_versies bv on bv.id = pb.brief_versie_id
  where pb.batch_id = p_batch_id
    and pb.verwijderd_op is null
    and bv.status <> 'verzonden';

  update public.off_market_printbatches
  set status = case when v_openstaand = 0 then 'gepost' else 'gedeeltelijk_gepost' end,
      verzenddatum = p_verzenddatum
  where id = p_batch_id;
end;
$$;

revoke all on function public.off_market_brief_definitief_maken(uuid, uuid, uuid, text, integer, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.off_market_batch_documenten_registreren(uuid, uuid, text, integer, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.off_market_batch_geprint_markeren(uuid, uuid, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.off_market_brief_gepost_markeren(uuid, uuid, uuid, text, uuid, text, integer, timestamptz) from public, anon, authenticated;

-- Reviewbestand: structurele geldigheid kan in een geïsoleerde database worden
-- getest, maar dit concept wordt hier bewust niet gecommit.
rollback;
