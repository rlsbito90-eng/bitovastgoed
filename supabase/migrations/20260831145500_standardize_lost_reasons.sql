-- Bito CRM — standardized loss / archive reason codes
--
-- Preserve all existing free-text reasons. Add a stable analytical code beside
-- the human-readable text so reporting can aggregate without destroying history.

alter table public.objecten
  add column if not exists archived_reason_code text;

alter table public.deals
  add column if not exists archived_reason_code text;

alter table public.object_pipeline
  add column if not exists lost_reason_code text;

-- Canonical classifier. Intentionally conservative: unknown text becomes 'other'.
-- A won result must be explicitly described as successful/completed; merely
-- mentioning "via Bito" is not enough evidence to realize a fee.
create or replace function public.bito_loss_reason_code(p_reason text)
returns text
language sql
immutable
as $$
  select case
    when p_reason is null or btrim(p_reason) = '' then null
    when lower(p_reason) like '%succesvol%' or lower(p_reason) like '%afgerond%' then 'won'
    when lower(p_reason) like '%prijs%' or lower(p_reason) like '%waard%' or lower(p_reason) like '%te duur%' then 'price_gap'
    when lower(p_reason) like '%extern%' or lower(p_reason) like '%andere partij%' or lower(p_reason) like '%derde%' then 'sold_external'
    when lower(p_reason) like '%ingetrokken%' or lower(p_reason) like '%eigenaar%' then 'seller_withdrew'
    when lower(p_reason) like '%koper afgehaakt%' or lower(p_reason) like '%kandidaat afgehaakt%' then 'buyer_withdrew'
    when lower(p_reason) like '%investment%' or lower(p_reason) like '%haalbaar%' or lower(p_reason) like '%bouwkost%' or lower(p_reason) like '%financier%' then 'investment_case_failed'
    when lower(p_reason) like '%geen passende%' or lower(p_reason) like '%geen kandidaat%' or lower(p_reason) like '%geen koper%' then 'no_suitable_buyer'
    when lower(p_reason) like '%funda%' or lower(p_reason) like '%publiek%' or lower(p_reason) like '%open markt%' then 'public_market'
    when lower(p_reason) like '%informatie%' or lower(p_reason) like '%document%' then 'insufficient_information'
    when lower(p_reason) like '%timing%' or lower(p_reason) like '%proces%' or lower(p_reason) like '%te laat%' then 'process_timing'
    when lower(p_reason) like '%handmatig%' then 'manual_archive'
    else 'other'
  end;
$$;

comment on function public.bito_loss_reason_code(text) is
  'Maps preserved human-readable CRM archive/loss reasons to stable analytical reason codes. Won requires explicit success/completion wording.';

-- Backfill without changing the original reason text.
update public.objecten
set archived_reason_code = public.bito_loss_reason_code(archived_reason)
where archived_reason is not null
  and archived_reason_code is null;

update public.deals
set archived_reason_code = public.bito_loss_reason_code(coalesce(archived_reason, afwijzingsreden))
where coalesce(archived_reason, afwijzingsreden) is not null
  and archived_reason_code is null;

update public.object_pipeline
set lost_reason_code = public.bito_loss_reason_code(reden_afgevallen)
where reden_afgevallen is not null
  and lost_reason_code is null;

-- Keep codes in sync for future writes while leaving the original text intact.
create or replace function public.sync_object_archived_reason_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.archived_reason is distinct from old.archived_reason then
    new.archived_reason_code := public.bito_loss_reason_code(new.archived_reason);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_object_archived_reason_code on public.objecten;
create trigger trg_object_archived_reason_code
before update of archived_reason on public.objecten
for each row
execute function public.sync_object_archived_reason_code();

create or replace function public.sync_deal_archived_reason_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.archived_reason is distinct from old.archived_reason
     or new.afwijzingsreden is distinct from old.afwijzingsreden then
    new.archived_reason_code := public.bito_loss_reason_code(coalesce(new.archived_reason, new.afwijzingsreden));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_deal_archived_reason_code on public.deals;
create trigger trg_deal_archived_reason_code
before update of archived_reason, afwijzingsreden on public.deals
for each row
execute function public.sync_deal_archived_reason_code();

create or replace function public.sync_pipeline_lost_reason_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.reden_afgevallen is distinct from old.reden_afgevallen then
    new.lost_reason_code := public.bito_loss_reason_code(new.reden_afgevallen);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pipeline_lost_reason_code on public.object_pipeline;
create trigger trg_pipeline_lost_reason_code
before update of reden_afgevallen on public.object_pipeline
for each row
execute function public.sync_pipeline_lost_reason_code();

comment on column public.objecten.archived_reason_code is
  'Stable analytical archive/loss reason code; archived_reason remains the preserved human-readable reason.';
comment on column public.deals.archived_reason_code is
  'Stable analytical archive/loss reason code; original text remains preserved.';
comment on column public.object_pipeline.lost_reason_code is
  'Stable analytical candidate-loss reason code; reden_afgevallen remains preserved.';
