-- TRACK-2 release 6 — reconciliatie van reeds toegepaste productiemigratie.

create or replace function public.off_market_productiekern_assert_interne_actor(p_actor_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid;
begin
  v_user_id:=auth.uid();
  if v_user_id is null then raise exception 'productiekern_auth_verplicht'; end if;
  if p_actor_id is null or p_actor_id is distinct from v_user_id then raise exception 'productiekern_actor_mismatch'; end if;
  if not public.is_intern_gebruiker(v_user_id) then raise exception 'productiekern_intern_gebruiker_verplicht'; end if;
end; $$;
revoke all on function public.off_market_productiekern_assert_interne_actor(uuid) from public,anon,authenticated;

alter function public.off_market_verwerking_starten(uuid,uuid,text,timestamptz) rename to off_market_verwerking_starten_intern;
alter function public.off_market_brief_reserveren(uuid,uuid,text,timestamptz) rename to off_market_brief_reserveren_intern;
alter function public.off_market_briefversie_aanmaken(uuid,uuid,text,timestamptz,jsonb,jsonb) rename to off_market_briefversie_aanmaken_intern;
alter function public.off_market_printbatch_aanmaken(uuid,text,timestamptz,date) rename to off_market_printbatch_aanmaken_intern;
alter function public.off_market_briefversie_aan_batch_toevoegen(uuid,uuid,uuid,uuid,text,timestamptz) rename to off_market_briefversie_aan_batch_toevoegen_intern;
alter function public.off_market_brief_definitief_maken(uuid,uuid,uuid,text,integer,timestamptz,integer) rename to off_market_brief_definitief_maken_intern;
alter function public.off_market_batch_documenten_registreren(uuid,uuid,text,integer,timestamptz,jsonb) rename to off_market_batch_documenten_registreren_intern;
alter function public.off_market_batch_geprint_markeren(uuid,uuid,text,integer,timestamptz) rename to off_market_batch_geprint_markeren_intern;
alter function public.off_market_brief_gepost_markeren(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) rename to off_market_brief_gepost_markeren_intern;

revoke all on function public.off_market_verwerking_starten_intern(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_reserveren_intern(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aanmaken_intern(uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.off_market_printbatch_aanmaken_intern(uuid,text,timestamptz,date) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aan_batch_toevoegen_intern(uuid,uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_definitief_maken_intern(uuid,uuid,uuid,text,integer,timestamptz,integer) from public,anon,authenticated;
revoke all on function public.off_market_batch_documenten_registreren_intern(uuid,uuid,text,integer,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.off_market_batch_geprint_markeren_intern(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_gepost_markeren_intern(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) from public,anon,authenticated;

create function public.off_market_verwerking_starten(p_selectie_id uuid,p_actor_id uuid,p_operation_key text,p_uitgevoerd_op timestamptz)
returns table(selectie_id uuid,signaal_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  return query select * from public.off_market_verwerking_starten_intern(p_selectie_id,p_actor_id,p_operation_key,p_uitgevoerd_op);
end; $$;

create function public.off_market_brief_reserveren(p_selectie_id uuid,p_actor_id uuid,p_operation_key text,p_uitgevoerd_op timestamptz)
returns table(brief_id uuid,signaal_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  return query select * from public.off_market_brief_reserveren_intern(p_selectie_id,p_actor_id,p_operation_key,p_uitgevoerd_op);
end; $$;

create function public.off_market_briefversie_aanmaken(p_brief_id uuid,p_actor_id uuid,p_operation_key text,p_uitgevoerd_op timestamptz,p_inhoud_snapshot jsonb,p_geadresseerde_snapshot jsonb)
returns table(brief_versie_id uuid,versienummer integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  return query select * from public.off_market_briefversie_aanmaken_intern(p_brief_id,p_actor_id,p_operation_key,p_uitgevoerd_op,p_inhoud_snapshot,p_geadresseerde_snapshot);
end; $$;

create function public.off_market_printbatch_aanmaken(p_actor_id uuid,p_operation_key text,p_uitgevoerd_op timestamptz,p_datum date)
returns table(batch_id uuid,batchnummer text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  return query select * from public.off_market_printbatch_aanmaken_intern(p_actor_id,p_operation_key,p_uitgevoerd_op,p_datum);
end; $$;

create function public.off_market_briefversie_aan_batch_toevoegen(p_batch_id uuid,p_brief_id uuid,p_brief_versie_id uuid,p_actor_id uuid,p_operation_key text,p_uitgevoerd_op timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  perform public.off_market_briefversie_aan_batch_toevoegen_intern(p_batch_id,p_brief_id,p_brief_versie_id,p_actor_id,p_operation_key,p_uitgevoerd_op);
end; $$;

create function public.off_market_brief_definitief_maken(p_brief_id uuid,p_brief_versie_id uuid,p_actor_id uuid,p_operation_key text,p_verwacht_versienummer integer,p_uitgevoerd_op timestamptz,p_jaar integer)
returns table(brief_id uuid,briefnummer text)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  return query select * from public.off_market_brief_definitief_maken_intern(p_brief_id,p_brief_versie_id,p_actor_id,p_operation_key,p_verwacht_versienummer,p_uitgevoerd_op,p_jaar);
end; $$;

create function public.off_market_batch_documenten_registreren(p_batch_id uuid,p_actor_id uuid,p_operation_key text,p_verwacht_documentversie integer,p_uitgevoerd_op timestamptz,p_documenten jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  perform public.off_market_batch_documenten_registreren_intern(p_batch_id,p_actor_id,p_operation_key,p_verwacht_documentversie,p_uitgevoerd_op,p_documenten);
end; $$;

create function public.off_market_batch_geprint_markeren(p_batch_id uuid,p_actor_id uuid,p_operation_key text,p_verwacht_documentversie integer,p_printdatum timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  perform public.off_market_batch_geprint_markeren_intern(p_batch_id,p_actor_id,p_operation_key,p_verwacht_documentversie,p_printdatum);
end; $$;

create function public.off_market_brief_gepost_markeren(p_brief_id uuid,p_brief_versie_id uuid,p_batch_id uuid,p_geadresseerde_key text,p_actor_id uuid,p_operation_key text,p_verwacht_versienummer integer,p_verzenddatum timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);
  perform public.off_market_brief_gepost_markeren_intern(p_brief_id,p_brief_versie_id,p_batch_id,p_geadresseerde_key,p_actor_id,p_operation_key,p_verwacht_versienummer,p_verzenddatum);
end; $$;

revoke all on function public.off_market_verwerking_starten(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_reserveren(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aanmaken(uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.off_market_printbatch_aanmaken(uuid,text,timestamptz,date) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aan_batch_toevoegen(uuid,uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_definitief_maken(uuid,uuid,uuid,text,integer,timestamptz,integer) from public,anon,authenticated;
revoke all on function public.off_market_batch_documenten_registreren(uuid,uuid,text,integer,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.off_market_batch_geprint_markeren(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_gepost_markeren(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) from public,anon,authenticated;
