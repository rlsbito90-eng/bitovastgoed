-- Bito CRM — Unified Object / Deal lifecycle, phase 2
--
-- Goals:
-- 1. Object terminal availability statuses drive the concrete transaction Deal.
-- 2. Preserve legacy safety: never guess a winner when historical data contains
--    multiple active candidate-Deals and no accepted bid identifies the buyer.
-- 3. Establish one economic fee source for reporting:
--      no Deal   -> Object forecast fee
--      Deal      -> Deal fee (Object forecast is reference-only)
--      closed won Deal -> realized Deal fee

-- ---------------------------------------------------------------------------
-- Object-level fee forecast. This is deliberately separate from Deal fee.
-- A Deal fee is the contract/transaction amount and always wins for reporting.
-- ---------------------------------------------------------------------------
alter table public.objecten
  add column if not exists verwachte_fee_pct numeric,
  add column if not exists verwachte_fee_bedrag numeric,
  add column if not exists verwachte_fee_structuur text;

comment on column public.objecten.verwachte_fee_pct is
  'Forecast fee percentage before a concrete transaction Deal exists.';
comment on column public.objecten.verwachte_fee_bedrag is
  'Forecast fee amount before a concrete transaction Deal exists. Reference-only once a Deal exists.';
comment on column public.objecten.verwachte_fee_structuur is
  'Forecast fee structure/notes before a concrete transaction Deal exists.';

-- ---------------------------------------------------------------------------
-- Terminal status -> Deal synchronization
-- ---------------------------------------------------------------------------
create or replace function public.sync_deals_from_object_terminal_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_winner_deal_id uuid;
  v_active_count integer := 0;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Seller withdraws the asset: every still-active transaction attempt loses.
  if new.status = 'ingetrokken' then
    update public.deals
    set fase = 'afgevallen'::public.deal_fase,
        is_archived = true,
        archived_at = coalesce(archived_at, v_now),
        archived_reason = coalesce(archived_reason, 'Object ingetrokken door eigenaar'),
        afwijzingsreden = coalesce(afwijzingsreden, 'Verkoper heeft object ingetrokken'),
        closed_at = null,
        updated_at = v_now
    where object_id = new.id
      and soft_deleted_at is null
      and is_archived = false;

    return new;
  end if;

  if new.status <> 'verkocht' then
    return new;
  end if;

  -- Preferred source: accepted bid explicitly linked to a Deal.
  select b.deal_id
    into v_winner_deal_id
  from public.biedingen b
  where b.object_id = new.id
    and b.status = 'geaccepteerd'
    and b.deal_id is not null
  order by b.accepted_at desc nulls last, b.updated_at desc, b.created_at desc
  limit 1;

  -- Legacy fallback: only if there is exactly one active Deal may we safely
  -- infer that this is the transaction Deal. With >1 we intentionally do not
  -- guess: historical candidate-Deals must not all become won by accident.
  if v_winner_deal_id is null then
    select count(*)::integer
      into v_active_count
    from public.deals d
    where d.object_id = new.id
      and d.soft_deleted_at is null
      and d.is_archived = false;

    if v_active_count = 1 then
      select d.id
        into v_winner_deal_id
      from public.deals d
      where d.object_id = new.id
        and d.soft_deleted_at is null
        and d.is_archived = false
      limit 1;
    end if;
  end if;

  -- No Deal means the object may have been sold externally; there is no Bito
  -- transaction fee to realize. Multiple ambiguous legacy Deals are also left
  -- untouched instead of inventing a winner.
  if v_winner_deal_id is null then
    return new;
  end if;

  -- Winner: same economic fee moves from pipeline to realized, never duplicated.
  update public.deals
  set fase = 'afgerond'::public.deal_fase,
      is_archived = true,
      archived_at = coalesce(archived_at, v_now),
      archived_reason = coalesce(archived_reason, 'Succesvol afgerond'),
      closed_at = coalesce(closed_at, v_now),
      updated_at = v_now
  where id = v_winner_deal_id
    and soft_deleted_at is null;

  -- Other active transaction attempts on the same asset lose when a known
  -- winner closes. They never receive closed_at and never count as realized.
  update public.deals
  set fase = 'afgevallen'::public.deal_fase,
      is_archived = true,
      archived_at = coalesce(archived_at, v_now),
      archived_reason = coalesce(archived_reason, 'Object verkocht aan andere partij'),
      afwijzingsreden = coalesce(afwijzingsreden, 'Andere koper / transactiepartij gekozen'),
      closed_at = null,
      updated_at = v_now
  where object_id = new.id
    and id <> v_winner_deal_id
    and soft_deleted_at is null
    and is_archived = false;

  return new;
end;
$$;

drop trigger if exists trg_object_terminal_status_sync_deals on public.objecten;
create trigger trg_object_terminal_status_sync_deals
after update of status on public.objecten
for each row
when (old.status is distinct from new.status)
execute function public.sync_deals_from_object_terminal_status();

comment on function public.sync_deals_from_object_terminal_status() is
  'Synchronizes terminal Object availability status to concrete Deals. Won is inferred only from an accepted bid or a single unambiguous active Deal.';

-- ---------------------------------------------------------------------------
-- Canonical fee reporting view — explicit anti-double-count contract.
--
-- One row per Object. The view deliberately chooses exactly one forecast source:
-- - active Deal fee, when a Deal exists;
-- - otherwise Object forecast fee.
-- Realized fee is only a closed-won Deal fee and is excluded from pipeline fee.
-- ---------------------------------------------------------------------------
create or replace view public.object_fee_reporting as
with ranked_deals as (
  select
    d.*,
    row_number() over (
      partition by d.object_id
      order by
        case when d.closed_at is not null and d.fase = 'afgerond' then 0 else 1 end,
        d.updated_at desc,
        d.created_at desc
    ) as rn
  from public.deals d
  where d.soft_deleted_at is null
), chosen as (
  select *
  from ranked_deals
  where rn = 1
)
select
  o.id as object_id,
  c.id as deal_id,
  case
    when c.id is not null then 'deal'
    else 'object'
  end as fee_source,
  case
    when c.closed_at is not null and c.fase = 'afgerond' then 0::numeric
    when c.id is not null then coalesce(c.commissie_bedrag, 0)::numeric
    else coalesce(o.verwachte_fee_bedrag, 0)::numeric
  end as pipeline_fee,
  case
    when c.closed_at is not null and c.fase = 'afgerond'
      then coalesce(c.commissie_bedrag, 0)::numeric
    else 0::numeric
  end as realized_fee,
  o.verwachte_fee_bedrag as object_forecast_fee_reference,
  c.commissie_bedrag as deal_fee_reference
from public.objecten o
left join chosen c on c.object_id = o.id
where o.soft_deleted_at is null;

comment on view public.object_fee_reporting is
  'Canonical one-fee-per-object reporting projection. Deal fee supersedes Object forecast; closed-won fee moves from pipeline to realized instead of being added twice.';
