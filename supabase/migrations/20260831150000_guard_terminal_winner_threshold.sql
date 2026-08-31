-- Bito CRM — terminal-status winner guard
--
-- Tightens the phase-2 terminal sync. A historical single active Deal is NOT
-- enough evidence that Bito closed the transaction. Without an accepted bid,
-- the Object must already have reached Preferred bidder / exclusiviteit (or a
-- later stage) before a single active Deal may be inferred as the winner.

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
  v_has_transaction_position boolean := false;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Seller withdraws the asset: every still-active concrete transaction attempt
  -- loses. No Deal ever receives closed_at in this path.
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

  -- Explicit external sale is authoritative. Even if this object previously
  -- reached preferred bidder, Bito must not receive a realized transaction fee.
  -- All still-active transaction attempts lose because another party closed.
  if new.archived_reason_code = 'sold_external' then
    update public.deals
    set fase = 'afgevallen'::public.deal_fase,
        is_archived = true,
        archived_at = coalesce(archived_at, v_now),
        archived_reason = coalesce(archived_reason, 'Object verkocht aan andere partij'),
        afwijzingsreden = coalesce(afwijzingsreden, 'Object extern / aan andere partij verkocht'),
        closed_at = null,
        updated_at = v_now
    where object_id = new.id
      and soft_deleted_at is null
      and is_archived = false;

    return new;
  end if;

  -- Strongest evidence: an accepted bid explicitly linked to a Deal.
  select b.deal_id
    into v_winner_deal_id
  from public.biedingen b
  where b.object_id = new.id
    and b.status = 'geaccepteerd'
    and b.deal_id is not null
  order by b.accepted_at desc nulls last, b.updated_at desc, b.created_at desc
  limit 1;

  -- Determine whether the Object had actually crossed the transaction boundary.
  select coalesce(current_stage.sort_order >= preferred_stage.sort_order, false)
    into v_has_transaction_position
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
  where o.id = new.id;

  -- Legacy fallback is deliberately strict. Only after the Object crossed the
  -- preferred-bidder threshold may exactly one active Deal be inferred as winner.
  if v_winner_deal_id is null and v_has_transaction_position then
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

  -- No safely identified winner = no Bito realized transaction. This includes
  -- ambiguous historical candidate-Deal data.
  if v_winner_deal_id is null then
    return new;
  end if;

  update public.deals
  set fase = 'afgerond'::public.deal_fase,
      is_archived = true,
      archived_at = coalesce(archived_at, v_now),
      archived_reason = coalesce(archived_reason, 'Succesvol afgerond'),
      closed_at = coalesce(closed_at, v_now),
      updated_at = v_now
  where id = v_winner_deal_id
    and soft_deleted_at is null;

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

comment on function public.sync_deals_from_object_terminal_status() is
  'Terminal Object sync with strict winner guard: explicit external sale never wins; otherwise accepted bid, or exactly one active Deal only after preferred bidder / exclusivity. Never guesses a winner from legacy candidate Deals.';
