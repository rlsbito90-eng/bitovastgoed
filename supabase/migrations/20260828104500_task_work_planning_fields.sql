-- Bito CRM — Mijn werk planning v2
-- Additieve velden voor Things/Any.do-achtige werkplanning.
-- Deadline blijft een harde uiterste datum; plan_datum bepaalt wanneer een taak in Mijn werk verschijnt.

alter table public.taken
  add column if not exists plan_datum date,
  add column if not exists planning_bucket text not null default 'open';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'taken_planning_bucket_check'
      and conrelid = 'public.taken'::regclass
  ) then
    alter table public.taken
      add constraint taken_planning_bucket_check
      check (planning_bucket in ('open', 'inbox', 'later'));
  end if;
end $$;

comment on column public.taken.plan_datum is
  'Werkdatum: vanaf deze datum hoort de taak in Vandaag. Staat los van de harde deadline.';
comment on column public.taken.planning_bucket is
  'Persoonlijke werkbak: open, inbox of later. Bestaande taken blijven open.';

create index if not exists idx_taken_owner_planning_bucket
  on public.taken (owner_user_id, planning_bucket)
  where soft_deleted_at is null;

create index if not exists idx_taken_owner_plan_datum
  on public.taken (owner_user_id, plan_datum)
  where soft_deleted_at is null and plan_datum is not null;
