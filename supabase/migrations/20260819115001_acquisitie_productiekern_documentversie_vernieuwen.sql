-- Acquisitieproductiekern — veilige kwaliteitsupgrade voor een nog niet geprinte BAT.
--
-- De vier bestaande actieve documenten blijven als vervallen historie bewaard.
-- De batchversie en de vier nieuwe Storage-referenties worden in één transactie
-- geactiveerd. BR-, BAT- en immutable briefversie-identiteit wijzigen niet.

create or replace function public.off_market_batch_documentversie_vernieuwen(
  p_batch_id uuid,
  p_actor_id uuid,
  p_operation_key text,
  p_verwacht_documentversie integer,
  p_nieuwe_documentversie integer,
  p_uitgevoerd_op timestamptz,
  p_reden text,
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
  v_printdatum timestamptz;
  v_document jsonb;
  v_referentie text;
  v_pad text;
  v_prefix text;
  v_referenties text[] := array[]::text[];
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);

  if nullif(trim(p_operation_key), '') is null then raise exception 'operation_key_verplicht'; end if;
  if p_uitgevoerd_op is null then raise exception 'uitvoeringstijdstip_verplicht'; end if;
  if nullif(trim(p_reden), '') is null then raise exception 'documentvernieuwing_reden_verplicht'; end if;
  if length(trim(p_reden)) > 500 then raise exception 'documentvernieuwing_reden_te_lang'; end if;
  if p_verwacht_documentversie < 1 then raise exception 'ongeldige_documentversie'; end if;
  if p_nieuwe_documentversie <> p_verwacht_documentversie + 1 then
    raise exception 'nieuwe_documentversie_niet_opvolgend';
  end if;
  if jsonb_typeof(p_documenten) <> 'array' or jsonb_array_length(p_documenten) <> 4 then
    raise exception 'exact_vier_batchdocumenten_verplicht';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_key, 0));
  if exists (
    select 1 from public.off_market_productie_events where operation_key = p_operation_key
  ) then
    return;
  end if;

  select status, documentversie, printdatum
  into v_status, v_documentversie, v_printdatum
  from public.off_market_printbatches
  where id = p_batch_id
  for update;

  if not found then raise exception 'batch_niet_gevonden'; end if;
  if v_status <> 'documenten_gegenereerd' or v_printdatum is not null then
    raise exception 'batchstatus_blokkeert_documentvernieuwing';
  end if;
  if v_documentversie <> p_verwacht_documentversie then
    raise exception 'optimistic_lock_conflict';
  end if;
  if (
    select count(*)
    from public.off_market_batchdocumenten
    where batch_id = p_batch_id and status = 'actief'
  ) <> 4 then
    raise exception 'actieve_documentset_niet_compleet';
  end if;
  if exists (
    select 1
    from public.off_market_batchdocumenten
    where batch_id = p_batch_id
      and status = 'actief'
      and documentversie <> p_verwacht_documentversie
  ) then
    raise exception 'actieve_documentset_versiedrift';
  end if;

  v_prefix := 'off-market-productie/'
    || p_actor_id::text || '/'
    || p_batch_id::text || '/v'
    || p_nieuwe_documentversie::text || '/';

  for v_document in select value from jsonb_array_elements(p_documenten) loop
    v_referentie := nullif(trim(v_document->>'bestand_referentie'), '');
    if v_referentie is null then raise exception 'bestand_referentie_verplicht'; end if;
    if position('..' in v_referentie) > 0 then raise exception 'ongeldige_bestand_referentie'; end if;
    if left(v_referentie, length(v_prefix)) <> v_prefix then
      raise exception 'bestand_referentie_buiten_nieuwe_documentversie';
    end if;
    if v_referentie = any(v_referenties) then raise exception 'dubbele_bestand_referentie'; end if;
    v_referenties := array_append(v_referenties, v_referentie);

    v_pad := substr(v_referentie, length('off-market-productie/') + 1);
    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'off-market-productie'
        and o.name = v_pad
    ) then
      raise exception 'batchdocument_storage_object_ontbreekt';
    end if;
  end loop;

  update public.off_market_printbatches
  set documentversie = p_nieuwe_documentversie,
      heropend_op = p_uitgevoerd_op
  where id = p_batch_id;

  perform public.off_market_batch_documenten_registreren_intern(
    p_batch_id,
    p_actor_id,
    p_operation_key,
    p_nieuwe_documentversie,
    p_uitgevoerd_op,
    p_documenten
  );

  update public.off_market_productie_events
  set metadata = metadata || jsonb_build_object(
    'vorige_documentversie', p_verwacht_documentversie,
    'documentversie', p_nieuwe_documentversie,
    'vervangende_documentset', true,
    'reden', trim(p_reden)
  )
  where operation_key = p_operation_key;
end;
$$;

revoke all on function public.off_market_batch_documentversie_vernieuwen(
  uuid, uuid, text, integer, integer, timestamptz, text, jsonb
) from public, anon, authenticated;

grant execute on function public.off_market_batch_documentversie_vernieuwen(
  uuid, uuid, text, integer, integer, timestamptz, text, jsonb
) to authenticated;

