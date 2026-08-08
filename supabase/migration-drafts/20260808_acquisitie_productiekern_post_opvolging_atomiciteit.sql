-- BUILD A — ATOMISCHE POST → OPVOLGING
-- NIET AUTOMATISCH TOEPASSEN.
-- Reviewdraft buiten supabase/migrations. Vervangt uitsluitend de bestaande
-- post-RPC met dezelfde signatuur; geen grants, activatie of backfill.

begin;

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
  v_selectie_id uuid;
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

  select status, selectie_id into v_briefstatus, v_selectie_id
  from public.off_market_brieven where id = p_brief_id for update;
  if not found then raise exception 'brief_niet_gevonden'; end if;
  if v_briefstatus <> 'definitief' then raise exception 'brief_niet_definitief'; end if;
  if v_selectie_id is null then raise exception 'brief_selectie_ontbreekt'; end if;

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

  if not exists (
    select 1 from public.off_market_acquisitie_dossiers
    where selectie_id = v_selectie_id
    for update
  ) then
    raise exception 'acquisitiedossier_niet_gevonden';
  end if;

  update public.off_market_brief_versies
  set status = 'verzonden', verzonden_op = p_verzenddatum
  where id = p_brief_versie_id;

  update public.off_market_acquisitie_dossiers
  set primaire_werkbak = 'opvolgen',
      volgende_actie_op = p_verzenddatum + interval '14 days',
      volgende_actie_omschrijving = 'Opvolgen na geposte brief',
      updated_at = p_verzenddatum
  where selectie_id = v_selectie_id;

  insert into public.off_market_productie_events (
    id, operation_key, event_type, brief_id, brief_versie_id, batch_id,
    selectie_id, actor_id, event_at, metadata
  ) values (
    gen_random_uuid(), p_operation_key, 'brief_gepost', p_brief_id,
    p_brief_versie_id, p_batch_id, v_selectie_id, p_actor_id, p_verzenddatum,
    jsonb_build_object(
      'geadresseerde_key', p_geadresseerde_key,
      'opvolgdatum', p_verzenddatum + interval '14 days'
    )
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

revoke all on function public.off_market_brief_gepost_markeren(uuid, uuid, uuid, text, uuid, text, integer, timestamptz)
  from public, anon, authenticated;

rollback;
