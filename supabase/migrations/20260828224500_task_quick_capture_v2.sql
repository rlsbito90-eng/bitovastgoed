-- Bito CRM — Quick Capture v2
-- Additief: werkplanning krijgt optionele tijd en taken kunnen meerdere CRM-entiteiten koppelen.

alter table public.taken
  add column if not exists plan_tijd time without time zone;

comment on column public.taken.plan_tijd is
  'Optionele werktijd voor plan_datum. Staat los van deadline_tijd en veroorzaakt op zichzelf geen deadline.';

create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.taken(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint task_links_entity_type_check check (entity_type in ('relatie', 'deal', 'object', 'signaal')),
  constraint task_links_unique unique (task_id, entity_type, entity_id)
);

create index if not exists idx_task_links_task_id on public.task_links(task_id);
create index if not exists idx_task_links_entity on public.task_links(entity_type, entity_id);

alter table public.task_links enable row level security;

drop policy if exists task_links_select_own on public.task_links;
create policy task_links_select_own on public.task_links
for select to authenticated
using (exists (
  select 1 from public.taken t
  where t.id = task_links.task_id
    and t.owner_user_id = auth.uid()
    and t.soft_deleted_at is null
));

drop policy if exists task_links_insert_own on public.task_links;
create policy task_links_insert_own on public.task_links
for insert to authenticated
with check (exists (
  select 1 from public.taken t
  where t.id = task_links.task_id
    and t.owner_user_id = auth.uid()
    and t.soft_deleted_at is null
));

drop policy if exists task_links_update_own on public.task_links;
create policy task_links_update_own on public.task_links
for update to authenticated
using (exists (
  select 1 from public.taken t
  where t.id = task_links.task_id
    and t.owner_user_id = auth.uid()
    and t.soft_deleted_at is null
))
with check (exists (
  select 1 from public.taken t
  where t.id = task_links.task_id
    and t.owner_user_id = auth.uid()
    and t.soft_deleted_at is null
));

drop policy if exists task_links_delete_own on public.task_links;
create policy task_links_delete_own on public.task_links
for delete to authenticated
using (exists (
  select 1 from public.taken t
  where t.id = task_links.task_id
    and t.owner_user_id = auth.uid()
));
