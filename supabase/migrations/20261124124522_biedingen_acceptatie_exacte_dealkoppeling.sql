CREATE OR REPLACE FUNCTION public.accept_bieding_en_start_deal(p_bieding_id uuid, p_wijs_andere_af boolean DEFAULT false)
 RETURNS TABLE(deal_id uuid, object_id uuid, relatie_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_bieding public.biedingen%rowtype;
  v_deal_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_object_id uuid;
  v_deal_count integer;
begin
  -- Serialize acceptances per object, before locking the individual bid.
  select b.object_id into v_object_id from public.biedingen b where b.id = p_bieding_id;
  if v_object_id is null then raise exception 'Bieding niet gevonden of mist object'; end if;
  perform 1 from public.objecten o where o.id = v_object_id for update;
  if not found then raise exception 'Object niet gevonden'; end if;
  select *
    into v_bieding
  from public.biedingen
  where id = p_bieding_id
  for update;

  if not found then
    raise exception 'Bieding niet gevonden';
  end if;

  if v_bieding.object_id is null or v_bieding.relatie_id is null then
    raise exception 'Bieding mist object of relatie';
  end if;

  if v_bieding.object_id <> v_object_id then
    raise exception 'Bieding is tussentijds gewijzigd. Laad opnieuw.';
  end if;
  if v_bieding.richting <> 'van_koper' or v_bieding.bedrag is null or v_bieding.bedrag <= 0 then
    raise exception 'Alleen een positief kopersbod kan worden geaccepteerd';
  end if;
  if v_bieding.status in ('afgewezen','ingetrokken','verlopen') then
    raise exception 'Dit bod is afgesloten; registreer een nieuw voorstel';
  end if;

  update public.biedingen
  set status = 'geaccepteerd',
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
  where id = p_bieding_id;

  if p_wijs_andere_af then
    update public.biedingen
    set status = 'afgewezen',
        rejected_at = coalesce(rejected_at, now()),
        rejected_reason = coalesce(rejected_reason, 'Niet gekozen — ander bod geaccepteerd'),
        updated_at = now()
    where biedingen.object_id = v_bieding.object_id
      and biedingen.id <> p_bieding_id
      and status in (
        'concept',
        'ontvangen',
        'in_behandeling',
        'tegenvoorstel_gedaan',
        'aangepast_bod_gevraagd'
      );
  end if;

  -- Preserve an explicitly selected valid deal. Never reuse a closed deal.
  if v_bieding.deal_id is not null then
    select d.id into v_deal_id from public.deals d
    where d.id = v_bieding.deal_id and d.object_id = v_bieding.object_id
      and d.relatie_id = v_bieding.relatie_id and d.soft_deleted_at is null
      and d.is_archived = false and d.fase not in ('afgerond','afgevallen')
    for update;
    if v_deal_id is null then
      raise exception 'De gekoppelde deal is niet actief of hoort bij een ander object of koper';
    end if;
  else
    select count(*) into v_deal_count from public.deals d
    where d.object_id = v_bieding.object_id and d.relatie_id = v_bieding.relatie_id
      and d.soft_deleted_at is null and d.is_archived = false and d.fase not in ('afgerond','afgevallen');
    if v_deal_count > 1 then raise exception 'Meerdere actieve deals gevonden; kies de juiste deal'; end if;
    select d.id into v_deal_id from public.deals d
    where d.object_id = v_bieding.object_id and d.relatie_id = v_bieding.relatie_id
      and d.soft_deleted_at is null and d.is_archived = false and d.fase not in ('afgerond','afgevallen')
    limit 1 for update;
  end if;

  if v_deal_id is null then
    insert into public.deals (
      object_id,
      relatie_id,
      fase,
      interessegraad,
      datum_eerste_contact,
      indicatief_bod
    ) values (
      v_bieding.object_id,
      v_bieding.relatie_id,
      'onderhandeling',
      5,
      coalesce(v_bieding.bieddatum, current_date),
      v_bieding.bedrag
    )
    returning id into v_deal_id;
  else
    update public.deals
    set fase = case
          when fase in ('lead', 'introductie', 'interesse', 'bezichtiging', 'bieding')
            then 'onderhandeling'::public.deal_fase
          else fase
        end,
        indicatief_bod = coalesce(v_bieding.bedrag, indicatief_bod),
        updated_at = now()
    where id = v_deal_id;
  end if;

  update public.biedingen
  set deal_id = v_deal_id,
      updated_at = now()
  where id = p_bieding_id;

  select p.id
    into v_pipeline_id
  from public.pipelines p
  where p.entity_type = 'object'
    and p.is_active = true
  order by p.is_default desc, p.created_at asc
  limit 1;

  if v_pipeline_id is not null then
    select ps.id
      into v_stage_id
    from public.pipeline_stages ps
    where ps.pipeline_id = v_pipeline_id
      and ps.slug = 'preferred_bidder'
      and ps.is_active = true
    limit 1;
  end if;

  if v_stage_id is not null then
    update public.objecten
    set pipeline_id = v_pipeline_id,
        pipeline_stage_id = v_stage_id,
        pipeline_updated_at = now(),
        pipeline_stage_locked = false,
        updated_at = now()
    where id = v_bieding.object_id;
  end if;

  return query
  select v_deal_id, v_bieding.object_id, v_bieding.relatie_id;
end;
$function$;
