-- Deal follow-up -> centrale taak.
--
-- Ontwerpregels:
-- - deals.datum_follow_up/follow_up_tijd blijven tijdelijk compatibility/read-model velden;
-- - de actieve gebruikersactie leeft canoniek in public.taken;
-- - wijziging van datum/tijd werkt dezelfde actieve taak bij;
-- - wissen van follow-up annuleert de actieve bron-taak, historie blijft staan;
-- - nooit een eigenaar gokken: zonder auth.uid() en zonder bestaande actieve taak geen insert.

create or replace function public.sync_deal_followup_task()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_task_id uuid;
  v_followup_active boolean;
begin
  -- Soft-deleted/gearchiveerde/afgeronde deals mogen geen actieve follow-uptaak houden.
  v_followup_active := new.soft_deleted_at is null
    and coalesce(new.is_archived, false) = false
    and new.fase not in ('afgerond', 'afgevallen')
    and new.datum_follow_up is not null;

  -- Bestaande actieve bron-taak bepaalt eigenaar wanneer aanwezig.
  select t.id, t.owner_user_id
    into v_task_id, v_user_id
  from public.taken t
  where t.source_kind = 'deal'
    and t.source_id = new.id
    and t.source_slot = 'follow_up'
    and t.soft_deleted_at is null
    and t.status in ('open', 'in_uitvoering', 'wacht_op_reactie')
  order by t.created_at asc, t.id asc
  limit 1;

  -- Bij een gewone app-write is auth.uid() de juiste gebruiker.
  v_user_id := coalesce(v_user_id, auth.uid());

  if not v_followup_active then
    if v_task_id is not null then
      update public.taken
      set status = 'geannuleerd'
      where id = v_task_id;
    end if;
    return new;
  end if;

  -- Safety: nooit stilzwijgend aan een willekeurige gebruiker koppelen.
  if v_user_id is null then
    return new;
  end if;

  if v_task_id is not null then
    update public.taken
    set owner_user_id = v_user_id,
        titel = 'Deal opvolgen',
        type_taak = 'Follow-up',
        deadline = new.datum_follow_up,
        deadline_tijd = new.follow_up_tijd,
        prioriteit = coalesce(prioriteit, 'normaal'),
        relatie_id = new.relatie_id,
        object_id = new.object_id,
        deal_id = new.id,
        source_kind = 'deal',
        source_id = new.id,
        source_slot = 'follow_up'
    where id = v_task_id;
    return new;
  end if;

  insert into public.taken (
    owner_user_id,
    titel,
    type_taak,
    deadline,
    deadline_tijd,
    prioriteit,
    status,
    relatie_id,
    object_id,
    deal_id,
    source_kind,
    source_id,
    source_slot
  ) values (
    v_user_id,
    'Deal opvolgen',
    'Follow-up',
    new.datum_follow_up,
    new.follow_up_tijd,
    'normaal',
    'open',
    new.relatie_id,
    new.object_id,
    new.id,
    'deal',
    new.id,
    'follow_up'
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.sync_deal_followup_task() from public;

-- Alleen relevante wijzigingen hoeven de sync te draaien.
drop trigger if exists trg_sync_deal_followup_task on public.deals;
create trigger trg_sync_deal_followup_task
after insert or update of datum_follow_up, follow_up_tijd, fase, is_archived, soft_deleted_at, relatie_id, object_id
on public.deals
for each row
execute function public.sync_deal_followup_task();
