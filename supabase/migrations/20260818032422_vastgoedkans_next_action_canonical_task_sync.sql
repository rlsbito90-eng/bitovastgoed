-- Vastgoedkans expliciete volgende actie -> centrale taak.
-- Legacy opvolgdatum/opvolgactie blijven uitsluitend fallback/read-compatibility en
-- worden bewust NIET door deze trigger naar een nieuwe taak gepromoveerd.

create or replace function public.sync_vastgoedkans_next_action_task()
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
begin
  v_active := new.status not in ('afgevallen', 'gepromoveerd')
    and new.volgende_actie_datum is not null;

  select t.id, t.owner_user_id
    into v_task_id, v_user_id
  from public.taken t
  where t.source_kind = 'vastgoedkans'
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

  v_title := coalesce(
    nullif(btrim(new.volgende_actie_omschrijving), ''),
    case
      when nullif(btrim(new.adres), '') is not null then 'Vastgoedkans opvolgen: ' || btrim(new.adres)
      else 'Vastgoedkans opvolgen'
    end
  );

  if v_task_id is not null then
    update public.taken
    set owner_user_id = v_user_id,
        titel = v_title,
        type_taak = 'Follow-up',
        deadline = new.volgende_actie_datum,
        deadline_tijd = null,
        prioriteit = case
          when new.prioriteit >= 4 then 'hoog'
          when new.prioriteit <= 1 then 'laag'
          else 'normaal'
        end,
        object_id = new.object_id,
        vastgoedkans_id = new.id,
        source_kind = 'vastgoedkans',
        source_id = new.id,
        source_slot = 'volgende_actie'
    where id = v_task_id;
    return new;
  end if;

  insert into public.taken (
    owner_user_id, titel, type_taak, deadline, deadline_tijd,
    prioriteit, status, object_id, vastgoedkans_id,
    source_kind, source_id, source_slot
  ) values (
    v_user_id, v_title, 'Follow-up', new.volgende_actie_datum, null,
    case
      when new.prioriteit >= 4 then 'hoog'
      when new.prioriteit <= 1 then 'laag'
      else 'normaal'
    end,
    'open', new.object_id, new.id,
    'vastgoedkans', new.id, 'volgende_actie'
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.sync_vastgoedkans_next_action_task() from public;

drop trigger if exists trg_sync_vastgoedkans_next_action_task on public.vastgoedkansen;
create trigger trg_sync_vastgoedkans_next_action_task
after insert or update of volgende_actie_datum, volgende_actie_omschrijving, status, prioriteit, object_id
on public.vastgoedkansen
for each row
execute function public.sync_vastgoedkans_next_action_task();
