-- Bito CRM — fee reporting ambiguity guard
--
-- The canonical fee projection must never pick an arbitrary legacy candidate-Deal.
-- A concrete Deal fee may replace the Object forecast only when the transaction
-- Deal is safely identifiable through an accepted bid, or there is exactly one
-- active Deal after the Object crossed Preferred bidder / exclusiviteit.

create or replace view public.object_fee_reporting
with (security_invoker = true)
as
with object_context as (
  select
    o.*,
    current_stage.sort_order as current_stage_order,
    preferred_stage.sort_order as preferred_stage_order,
    (
      current_stage.sort_order is not null
      and preferred_stage.sort_order is not null
      and current_stage.sort_order >= preferred_stage.sort_order
    ) as has_transaction_position
  from public.objecten o
  left join public.pipeline_stages current_stage
    on current_stage.id = o.pipeline_stage_id
  left join lateral (
    select ps.sort_order
    from public.pipeline_stages ps
    where ps.pipeline_id = coalesce(o.pipeline_id, current_stage.pipeline_id)
      and ps.slug = 'preferred_bidder'
      and ps.is_active = true
    order by ps.sort_order asc
    limit 1
  ) preferred_stage on true
  where o.soft_deleted_at is null
),
active_deal_counts as (
  select d.object_id, count(*)::integer as active_count
  from public.deals d
  where d.soft_deleted_at is null
    and d.is_archived = false
    and d.object_id is not null
  group by d.object_id
),
accepted_active_deal as (
  select distinct on (b.object_id)
    b.object_id,
    d.id as deal_id,
    d.commissie_bedrag,
    d.is_archived
  from public.biedingen b
  join public.deals d
    on d.id = b.deal_id
   and d.soft_deleted_at is null
   and d.is_archived = false
  where b.status = 'geaccepteerd'
    and b.deal_id is not null
  order by b.object_id, b.accepted_at desc nulls last, b.updated_at desc, b.created_at desc
),
single_active_deal as (
  select
    d.object_id,
    d.id as deal_id,
    d.commissie_bedrag,
    d.is_archived
  from public.deals d
  join active_deal_counts adc
    on adc.object_id = d.object_id
   and adc.active_count = 1
  where d.soft_deleted_at is null
    and d.is_archived = false
),
latest_closed_won as (
  select distinct on (d.object_id)
    d.object_id,
    d.id as deal_id,
    d.commissie_bedrag,
    d.closed_at
  from public.deals d
  where d.soft_deleted_at is null
    and d.object_id is not null
    and d.closed_at is not null
    and d.fase = 'afgerond'::public.deal_fase
  order by d.object_id, d.closed_at desc, d.updated_at desc, d.created_at desc
),
context as (
  select
    o.*,
    cw.deal_id as realized_deal_id,
    cw.commissie_bedrag as realized_deal_fee,
    cw.closed_at as realized_at_value,
    case
      when aad.deal_id is not null then aad.deal_id
      when o.has_transaction_position and coalesce(adc.active_count, 0) = 1 then sad.deal_id
      else null
    end as concrete_deal_id,
    case
      when aad.deal_id is not null then aad.commissie_bedrag
      when o.has_transaction_position and coalesce(adc.active_count, 0) = 1 then sad.commissie_bedrag
      else null
    end as concrete_deal_fee
  from object_context o
  left join active_deal_counts adc on adc.object_id = o.id
  left join accepted_active_deal aad on aad.object_id = o.id
  left join single_active_deal sad on sad.object_id = o.id
  left join latest_closed_won cw on cw.object_id = o.id
)
select
  c.id as object_id,
  coalesce(c.realized_deal_id, c.concrete_deal_id) as deal_id,
  case
    when c.realized_deal_id is not null then 'deal'
    when c.has_transaction_position and c.concrete_deal_id is not null then 'deal'
    else 'object'
  end as fee_source,
  case
    when c.realized_deal_id is not null then 0::numeric
    when c.has_transaction_position and c.concrete_deal_id is not null
      then coalesce(c.concrete_deal_fee, 0)::numeric
    when c.is_archived = false then coalesce(c.verwachte_fee_bedrag, 0)::numeric
    else 0::numeric
  end as pipeline_fee,
  case
    when c.realized_deal_id is not null
      then coalesce(c.realized_deal_fee, 0)::numeric
    else 0::numeric
  end as realized_fee,
  c.realized_at_value as realized_at,
  c.has_transaction_position,
  c.verwachte_fee_bedrag as object_forecast_fee_reference,
  case
    when c.realized_deal_id is not null then c.realized_deal_fee
    else c.concrete_deal_fee
  end as deal_fee_reference,
  case
    when c.realized_deal_id is not null then true
    when c.concrete_deal_id is not null then false
    else null
  end as deal_is_archived
from context c;

comment on view public.object_fee_reporting is
  'Canonical anti-double-count fee projection. Deal fee replaces Object forecast only for an accepted active Deal or one unambiguous active Deal after preferred bidder / exclusivity; ambiguous legacy Deals never get selected arbitrarily.';
