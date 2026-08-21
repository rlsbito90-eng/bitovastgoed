-- Fix object_pipeline updates failing because invalid text literals were
-- implicitly cast to public.pipeline_fase inside the next-action trigger.
-- Compare the enum as text so only the actual stored value is evaluated.

create or replace function public.sync_pipeline_next_action_task()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_task_id uuid;
  v_active boolean;
  v_title text;
  v_type text;
begin
  v_active := new.soft_deleted_at is null
    and new.pipeline_fase::text not in ('afgerond', 'afgevallen', 'afgehaakt', 'afgewezen_door_ons', 'gewonnen')
    and new.volgende_actie_datum is not null;

  select t.id, t.owner_user_id
    into v_task_id, v_user_id
  from public.taken t
  where t.source_kind = 'object_pipeline'
    and t.source_id = new.id
    and t.source_slot = 'volgende_actie'
    and t.soft_deleted_at is null
    and t.status in ('open', 'in_uitvoering', 'wacht_op_reactie')
  order by t.created_at asc, t.id asc
  limit 1;

  v_user_id := coalesce(v_user_id, auth.uid());

  if not v_active then
    if v_task_id is not null then
      update public.taken set status = 'geannuleerd' where id = v_task_id;
    end if;
    return new;
  end if;

  if v_user_id is null then
    return new;
  end if;

  v_title := coalesce(nullif(btrim(new.volgende_actie_omschrijving), ''), 'Volgende actie kandidaat');
  v_type := case new.volgende_actie
    when 'bellen' then 'Bellen'
    when 'mailen' then 'E-mailen'
    when 'whatsapp' then 'WhatsApp'
    when 'nda_opvolgen' then 'NDA opvolgen'
    when 'bieding_opvolgen' then 'Bieding opvolgen'
    when 'bod_opvolgen' then 'Bieding opvolgen'
    when 'bezichtiging_plannen' then 'Bezichtiging plannen'
    when 'bezichtiging_inplannen' then 'Bezichtiging plannen'
    else 'Follow-up'
  end;

  if v_task_id is not null then
    update public.taken
    set owner_user_id = v_user_id,
        titel = v_title,
        type_taak = v_type,
        deadline = new.volgende_actie_datum,
        deadline_tijd = null,
        prioriteit = coalesce(prioriteit, 'normaal'),
        relatie_id = new.relatie_id,
        object_id = new.object_id,
        deal_id = null,
        source_kind = 'object_pipeline',
        source_id = new.id,
        source_slot = 'volgende_actie'
    where id = v_task_id;
    return new;
  end if;

  insert into public.taken (
    owner_user_id, titel, type_taak, deadline, deadline_tijd,
    prioriteit, status, relatie_id, object_id,
    source_kind, source_id, source_slot
  ) values (
    v_user_id, v_title, v_type, new.volgende_actie_datum, null,
    'normaal', 'open', new.relatie_id, new.object_id,
    'object_pipeline', new.id, 'volgende_actie'
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.sync_pipeline_next_action_task() from public;
