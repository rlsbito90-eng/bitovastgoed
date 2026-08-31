-- Bito CRM — Unified Object / Deal lifecycle, phase 1
--
-- Object Pipeline is the canonical commercial lifecycle.
-- A Deal starts when a buyer becomes preferred bidder / enters an exclusive
-- transaction position. Existing Deal rows are reused to preserve history.

-- 1. Add the preferred-bidder stage between Onderhandeling and LOI.
insert into public.pipeline_stages (
  pipeline_id,
  name,
  slug,
  sort_order,
  probability,
  is_won,
  is_lost,
  is_active
)
select
  p.id,
  'Preferred bidder / exclusiviteit',
  'preferred_bidder',
  95,
  60,
  false,
  false,
  true
from public.pipelines p
where p.entity_type = 'object'
  and p.is_default = true
  and not exists (
    select 1
    from public.pipeline_stages ps
    where ps.pipeline_id = p.id
      and ps.slug = 'preferred_bidder'
  );

-- Fallback for installations where the object pipeline exists but is_default
-- was not set correctly.
insert into public.pipeline_stages (
  pipeline_id,
  name,
  slug,
  sort_order,
  probability,
  is_won,
  is_lost,
  is_active
)
select
  p.id,
  'Preferred bidder / exclusiviteit',
  'preferred_bidder',
  95,
  60,
  false,
  false,
  true
from public.pipelines p
where p.entity_type = 'object'
  and p.is_active = true
  and not exists (
    select 1
    from public.pipeline_stages ps
    where ps.pipeline_id = p.id
      and ps.slug = 'preferred_bidder'
  );

-- 2. Accepting a bid becomes the transaction boundary.
--    This function performs the state transition in one database transaction:
--      * accept bid
--      * optionally reject competing open bids
--      * create/reuse Deal for object + buyer
--      * link accepted bid to Deal
--      * move Object Pipeline to preferred bidder / exclusivity
--
-- `deals.fase` remains populated as a legacy compatibility projection for now;
-- it is no longer intended to be an independent user-maintained lifecycle.
create or replace function public.accept_bieding_en_start_deal(
  p_bieding_id uuid,
  p_wijs_andere_af boolean default false
)
returns table (
  deal_id uuid,
  object_id uuid,
  relatie_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bieding public.biedingen%rowtype;
  v_deal_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
begin
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
    where object_id = v_bieding.object_id
      and id <> p_bieding_id
      and status in (
        'concept',
        'ontvangen',
        'in_behandeling',
        'tegenvoorstel_gedaan',
        'aangepast_bod_gevraagd'
      );
  end if;

  -- Reuse an existing active Deal for the same object/buyer so historical
  -- CRM data is never duplicated merely because the lifecycle model changed.
  select d.id
    into v_deal_id
  from public.deals d
  where d.object_id = v_bieding.object_id
    and d.relatie_id = v_bieding.relatie_id
    and d.soft_deleted_at is null
    and d.is_archived = false
  order by d.created_at desc
  limit 1
  for update;

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
        -- Event-driven transition; keep automatic progression enabled.
        pipeline_stage_locked = false,
        updated_at = now()
    where id = v_bieding.object_id;
  end if;

  return query
  select v_deal_id, v_bieding.object_id, v_bieding.relatie_id;
end;
$$;

comment on function public.accept_bieding_en_start_deal(uuid, boolean) is
  'Canonical transaction boundary: accepting a bid creates/reuses the Deal and advances the Object Pipeline to preferred bidder / exclusivity.';
