-- Acquisitie Productiekern — server-side Storage guard vóór documentregistratie.
--
-- De browser kan geen willekeurige bestand_referentie laten registreren. Elke
-- referentie moet naar een werkelijk bestaand object in de private bucket wijzen
-- onder actor/batch/documentversie. De bestaande interne transactiefunctie blijft
-- verantwoordelijk voor de atomische document- en batchstatusmutatie.

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
  v_document jsonb;
  v_referentie text;
  v_pad text;
  v_prefix text;
  v_referenties text[] := array[]::text[];
begin
  perform public.off_market_productiekern_assert_interne_actor(p_actor_id);

  if jsonb_typeof(p_documenten) <> 'array' or jsonb_array_length(p_documenten) <> 4 then
    raise exception 'exact_vier_batchdocumenten_verplicht';
  end if;
  if p_verwacht_documentversie < 1 then raise exception 'ongeldige_documentversie'; end if;

  v_prefix := 'off-market-productie/'
    || p_actor_id::text || '/'
    || p_batch_id::text || '/v'
    || p_verwacht_documentversie::text || '/';

  for v_document in select value from jsonb_array_elements(p_documenten) loop
    v_referentie := nullif(trim(v_document->>'bestand_referentie'), '');
    if v_referentie is null then raise exception 'bestand_referentie_verplicht'; end if;
    if position('..' in v_referentie) > 0 then raise exception 'ongeldige_bestand_referentie'; end if;
    if left(v_referentie, length(v_prefix)) <> v_prefix then
      raise exception 'bestand_referentie_buiten_productiepad';
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

  perform public.off_market_batch_documenten_registreren_intern(
    p_batch_id,
    p_actor_id,
    p_operation_key,
    p_verwacht_documentversie,
    p_uitgevoerd_op,
    p_documenten
  );
end;
$$;

revoke all on function public.off_market_batch_documenten_registreren(uuid,uuid,text,integer,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.off_market_batch_documenten_registreren(uuid,uuid,text,integer,timestamptz,jsonb)
  to authenticated;
