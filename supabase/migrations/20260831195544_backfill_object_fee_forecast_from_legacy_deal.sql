-- Bito CRM — legacy fee forecast backfill
--
-- Existing CRM records used Deal rows early in the funnel mainly to surface fee
-- information on the dashboard. After Object Pipeline becomes canonical, those
-- legacy candidate-Deals must not become concrete transaction Deals merely
-- because they carry a fee. Instead, preserve the economic information by
-- copying the existing fee to the Object forecast for unambiguous pre-transaction
-- dossiers.
--
-- Safety contract:
-- * Object is active and not soft-deleted;
-- * Object is still before Preferred bidder / exclusiviteit;
-- * Object forecast amount is still empty;
-- * exactly one active legacy Deal exists for the Object;
-- * that Deal has an existing commissie_bedrag;
-- * multiple/ambiguous Deals are never guessed.

with object_context as (
  select
    o.id as object_id,
    o.verwachte_fee_bedrag,
    current_stage.sort_order as current_stage_order,
    preferred_stage.sort_order as preferred_stage_order
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
    and o.is_archived = false
),
active_deal_counts as (
  select d.object_id, count(*)::integer as active_count
  from public.deals d
  where d.soft_deleted_at is null
    and d.is_archived = false
    and d.object_id is not null
  group by d.object_id
),
eligible as (
  select
    oc.object_id,
    d.commissie_bedrag,
    d.commissie_pct,
    d.fee_structuur
  from object_context oc
  join active_deal_counts adc
    on adc.object_id = oc.object_id
   and adc.active_count = 1
  join public.deals d
    on d.object_id = oc.object_id
   and d.soft_deleted_at is null
   and d.is_archived = false
  where oc.verwachte_fee_bedrag is null
    and d.commissie_bedrag is not null
    and oc.preferred_stage_order is not null
    and (
      oc.current_stage_order is null
      or oc.current_stage_order < oc.preferred_stage_order
    )
)
update public.objecten o
set verwachte_fee_bedrag = e.commissie_bedrag::numeric,
    verwachte_fee_pct = coalesce(o.verwachte_fee_pct, e.commissie_pct),
    verwachte_fee_structuur = coalesce(o.verwachte_fee_structuur, e.fee_structuur),
    updated_at = now()
from eligible e
where o.id = e.object_id;

comment on column public.objecten.verwachte_fee_bedrag is
  'Forecast fee amount before a concrete transaction Deal exists. Legacy pre-transaction Deal fees were backfilled only for unambiguous single-active-Deal dossiers.';
