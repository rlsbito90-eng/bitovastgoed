-- Synchroniseer de formele Productiekern-status atomisch met de operationele
-- off_market_brieven-projectie die de Acquisitie-werkbak/readiness gebruikt.
-- Productiekern blijft de bron van waarheid; deze writes voorkomen dat dezelfde
-- fysieke handeling in twee schermen verschillende statussen toont.

create or replace function public.off_market_batch_geprint_markeren(
  p_batch_id uuid,p_actor_id uuid,p_operation_key text,p_verwacht_documentversie integer,p_printdatum timestamptz
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_documentversie integer; v_printdatum timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key,0));
  if exists(select 1 from public.off_market_productie_events where operation_key=p_operation_key) then return; end if;
  select status,documentversie,printdatum into v_status,v_documentversie,v_printdatum from public.off_market_printbatches where id=p_batch_id for update;
  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_status<>'documenten_gegenereerd' then raise exception 'batch_niet_printklaar'; end if;
  if v_printdatum is not null then raise exception 'printdatum_bestaat_al'; end if;
  if v_documentversie<>p_verwacht_documentversie then raise exception 'optimistic_lock_conflict'; end if;

  update public.off_market_printbatches
  set status='geprint',printdatum=p_printdatum
  where id=p_batch_id;

  -- De operationele werkbak leest nog uit off_market_brieven. Werk die projectie
  -- in dezelfde transactie bij, zodat 'Nog niet geprint' direct naar 'Te posten'
  -- doorstroomt zonder een tweede handmatige statusactie.
  update public.off_market_brieven b
  set verzendstatus='geprint',
      printdatum=p_printdatum::date,
      updated_at=p_printdatum
  where b.status='definitief'
    and exists (
      select 1
      from public.off_market_printbatch_brieven pb
      where pb.batch_id=p_batch_id
        and pb.brief_id=b.id
        and pb.verwijderd_op is null
    );

  insert into public.off_market_productie_events(id,operation_key,event_type,batch_id,actor_id,event_at,metadata)
  values(gen_random_uuid(),p_operation_key,'batch_geprint',p_batch_id,p_actor_id,p_printdatum,jsonb_build_object('documentversie',p_verwacht_documentversie));
end; $$;

create or replace function public.off_market_brief_gepost_markeren(
  p_brief_id uuid,p_brief_versie_id uuid,p_batch_id uuid,p_geadresseerde_key text,p_actor_id uuid,p_operation_key text,p_verwacht_versienummer integer,p_verzenddatum timestamptz
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_briefstatus text; v_versienummer integer; v_batchstatus text; v_printdatum timestamptz; v_openstaand integer;
begin
  if nullif(trim(p_geadresseerde_key),'') is null then raise exception 'geadresseerde_key_verplicht'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_key,0));
  if exists(select 1 from public.off_market_productie_events where operation_key=p_operation_key) then return; end if;
  select status into v_briefstatus from public.off_market_brieven where id=p_brief_id for update;
  if not found then raise exception 'brief_niet_gevonden'; end if;
  if v_briefstatus<>'definitief' then raise exception 'brief_niet_definitief'; end if;
  select versienummer into v_versienummer from public.off_market_brief_versies where id=p_brief_versie_id and brief_id=p_brief_id and status='actief' for update;
  if not found then raise exception 'actieve_briefversie_niet_gevonden'; end if;
  if v_versienummer<>p_verwacht_versienummer then raise exception 'optimistic_lock_conflict'; end if;
  select status,printdatum into v_batchstatus,v_printdatum from public.off_market_printbatches where id=p_batch_id for update;
  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_batchstatus not in ('geprint','gedeeltelijk_gepost') or v_printdatum is null then raise exception 'batch_niet_geprint'; end if;
  if not exists(select 1 from public.off_market_printbatch_brieven where batch_id=p_batch_id and brief_id=p_brief_id and brief_versie_id=p_brief_versie_id and verwijderd_op is null) then raise exception 'briefversie_niet_in_batch'; end if;

  update public.off_market_brief_versies
  set status='verzonden',verzonden_op=p_verzenddatum
  where id=p_brief_versie_id;

  -- Zelfde atomaire handeling, operationele projectie voor readiness/opvolging.
  update public.off_market_brieven
  set status='verstuurd',
      verzendstatus='gepost',
      postdatum=p_verzenddatum::date,
      verzonden_op=p_verzenddatum,
      updated_at=p_verzenddatum
  where id=p_brief_id;

  insert into public.off_market_productie_events(id,operation_key,event_type,brief_id,brief_versie_id,batch_id,actor_id,event_at,metadata)
  values(gen_random_uuid(),p_operation_key,'brief_gepost',p_brief_id,p_brief_versie_id,p_batch_id,p_actor_id,p_verzenddatum,jsonb_build_object('geadresseerde_key',p_geadresseerde_key));
  select count(*) into v_openstaand from public.off_market_printbatch_brieven pb join public.off_market_brief_versies bv on bv.id=pb.brief_versie_id where pb.batch_id=p_batch_id and pb.verwijderd_op is null and bv.status<>'verzonden';
  update public.off_market_printbatches set status=case when v_openstaand=0 then 'gepost' else 'gedeeltelijk_gepost' end,verzenddatum=p_verzenddatum where id=p_batch_id;
end; $$;

-- Reconcileer reeds uitgevoerde formele handelingen. Dit is idempotent en
-- raakt uitsluitend actief gekoppelde BAT-brieven met bewezen Productiekern-status.
update public.off_market_brieven b
set verzendstatus='geprint',
    printdatum=pb.printdatum::date,
    updated_at=greatest(b.updated_at,pb.printdatum)
from public.off_market_printbatch_brieven pbb
join public.off_market_printbatches pb on pb.id=pbb.batch_id
join public.off_market_brief_versies bv on bv.id=pbb.brief_versie_id
where pbb.brief_id=b.id
  and pbb.verwijderd_op is null
  and pb.status in ('geprint','gedeeltelijk_gepost')
  and pb.printdatum is not null
  and bv.status='actief'
  and b.status='definitief';

update public.off_market_brieven b
set status='verstuurd',
    verzendstatus='gepost',
    printdatum=coalesce(b.printdatum,pb.printdatum::date),
    postdatum=coalesce(bv.verzonden_op,pb.verzenddatum)::date,
    verzonden_op=coalesce(bv.verzonden_op,pb.verzenddatum),
    updated_at=greatest(b.updated_at,coalesce(bv.verzonden_op,pb.verzenddatum))
from public.off_market_printbatch_brieven pbb
join public.off_market_printbatches pb on pb.id=pbb.batch_id
join public.off_market_brief_versies bv on bv.id=pbb.brief_versie_id
where pbb.brief_id=b.id
  and pbb.verwijderd_op is null
  and bv.status='verzonden'
  and coalesce(bv.verzonden_op,pb.verzenddatum) is not null;
