-- Nieuwe Productiekern-printbatches worden als één fysieke verzendeenheid gepost.
--
-- Belangrijk:
-- - de bestaande off_market_brief_gepost_markeren RPC blijft bestaan voor het
--   afmaken van historische batches die al `gedeeltelijk_gepost` zijn;
-- - deze nieuwe RPC accepteert uitsluitend een volledig `geprint` batch;
-- - alle gekoppelde briefversies, operationele brieven en de BAT-status worden
--   in één database-transactie bijgewerkt met exact hetzelfde postmoment;
-- - opvolging voor fysieke post start vanaf de werkelijke postdatum (+21 dagen).

create or replace function public.off_market_batch_gepost_markeren(
  p_batch_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_verwacht_documentversie integer,
  p_verzenddatum timestamptz
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
  v_bestaande_verzenddatum timestamptz;
  v_aantal integer;
  v_postdatum date;
  v_event_brief_id uuid;
  v_event_brief_versie_id uuid;
begin
  if p_batch_id is null then raise exception 'batch_id_verplicht'; end if;
  if p_actor_id is null then raise exception 'actor_id_verplicht'; end if;
  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  if p_verzenddatum is null then raise exception 'verzenddatum_verplicht'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));

  -- Idempotente retry: dezelfde batchhandeling is dan al volledig uitgevoerd.
  if exists (
    select 1
    from public.off_market_productie_events
    where operation_key = p_operation_key
  ) then
    return;
  end if;

  select status, documentversie, printdatum, verzenddatum
    into v_status, v_documentversie, v_printdatum, v_bestaande_verzenddatum
  from public.off_market_printbatches
  where id = p_batch_id
  for update;

  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_status <> 'geprint' then raise exception 'batch_niet_geprint'; end if;
  if v_printdatum is null then raise exception 'printdatum_ontbreekt'; end if;
  if v_bestaande_verzenddatum is not null then raise exception 'verzenddatum_bestaat_al'; end if;
  if v_documentversie <> p_verwacht_documentversie then raise exception 'optimistic_lock_conflict'; end if;

  select count(*)
    into v_aantal
  from public.off_market_printbatch_brieven pb
  where pb.batch_id = p_batch_id
    and pb.verwijderd_op is null;

  if v_aantal = 0 then raise exception 'batch_zonder_brieven'; end if;

  -- Fail-closed vóór de eerste mutatie. Een geprinte BAT mag alleen atomisch
  -- worden gepost wanneer iedere actieve koppeling nog een definitieve brief
  -- met de bijbehorende actieve immutable versie bevat.
  if exists (
    select 1
    from public.off_market_printbatch_brieven pb
    left join public.off_market_brief_versies bv
      on bv.id = pb.brief_versie_id
    left join public.off_market_brieven b
      on b.id = pb.brief_id
    where pb.batch_id = p_batch_id
      and pb.verwijderd_op is null
      and (
        bv.id is null
        or b.id is null
        or bv.brief_id <> b.id
        or bv.status <> 'actief'
        or b.status <> 'definitief'
      )
  ) then
    raise exception 'batch_bevat_niet_verzendbare_brief';
  end if;

  -- Houd ook bij een streng audit-schema één bestaande brief/versie als
  -- representatieve referentie aan. De metadata blijft expliciet aangeven dat
  -- het event de volledige batchtransactie betreft.
  select pb.brief_id, pb.brief_versie_id
    into v_event_brief_id, v_event_brief_versie_id
  from public.off_market_printbatch_brieven pb
  where pb.batch_id = p_batch_id
    and pb.verwijderd_op is null
  order by pb.brief_id, pb.brief_versie_id
  limit 1;

  v_postdatum := (p_verzenddatum at time zone 'Europe/Amsterdam')::date;

  update public.off_market_brief_versies bv
  set status = 'verzonden',
      verzonden_op = p_verzenddatum
  where exists (
    select 1
    from public.off_market_printbatch_brieven pb
    where pb.batch_id = p_batch_id
      and pb.verwijderd_op is null
      and pb.brief_versie_id = bv.id
  );

  update public.off_market_brieven b
  set status = 'verstuurd',
      verzendstatus = 'gepost',
      printdatum = coalesce(b.printdatum, v_printdatum::date),
      postdatum = v_postdatum,
      verzonden_op = p_verzenddatum,
      opvolgdatum = v_postdatum + 21,
      updated_at = p_verzenddatum
  where exists (
    select 1
    from public.off_market_printbatch_brieven pb
    where pb.batch_id = p_batch_id
      and pb.verwijderd_op is null
      and pb.brief_id = b.id
  );

  update public.off_market_printbatches
  set status = 'gepost',
      verzenddatum = p_verzenddatum
  where id = p_batch_id;

  -- Gebruik het bestaande productie-eventtype; metadata maakt expliciet dat dit
  -- één atomische BAT-handeling was. De operation_key borgt idempotentie.
  insert into public.off_market_productie_events(
    id,
    operation_key,
    event_type,
    batch_id,
    brief_id,
    brief_versie_id,
    actor_id,
    event_at,
    metadata
  ) values (
    gen_random_uuid(),
    p_operation_key,
    'brief_gepost',
    p_batch_id,
    v_event_brief_id,
    v_event_brief_versie_id,
    p_actor_id,
    p_verzenddatum,
    jsonb_build_object(
      'modus', 'atomische_batch',
      'aantal_brieven', v_aantal,
      'postdatum', v_postdatum,
      'opvolgdatum', v_postdatum + 21,
      'documentversie', v_documentversie
    )
  );
end;
$$;

revoke all on function public.off_market_batch_gepost_markeren(uuid, uuid, text, integer, timestamptz) from public;
grant execute on function public.off_market_batch_gepost_markeren(uuid, uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.off_market_batch_gepost_markeren(uuid, uuid, text, integer, timestamptz) to service_role;
