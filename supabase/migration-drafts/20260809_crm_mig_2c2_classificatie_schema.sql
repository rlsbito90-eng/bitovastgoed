-- CRM-MIG-2C-2 — DRAFT ONLY / NIET UITVOEREN
-- Doelproject bij latere expliciete uitvoering: vyjocdlwfxrblusfngfq
-- Vereist vooraf: CRM_TARGET_PROJECT_ID=vyjocdlwfxrblusfngfq npm run crm:migratie:check-target
-- Seeddata is bewust NIET opgenomen.
-- Dit bestand staat onder migration-drafts en bevat een fail-closed transactiesentinel.

begin;

-- Fail-closed: een ongewijzigde draft mag nooit schemawijzigingen uitvoeren.
do $$
begin
  raise exception 'CRM-MIG-2C-2 is een niet-goedgekeurde DDL-draft. Verwijder deze sentinel uitsluitend in een apart goedgekeurde uitvoerings-BUILD voor vyjocdlwfxrblusfngfq.';
end
$$;

-- Alles hieronder blijft onbereikbaar zolang bovenstaande sentinel aanwezig is.

create table if not exists public.property_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.property_subtypes (
  id uuid primary key default gen_random_uuid(),
  property_type_id uuid not null references public.property_types(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (property_type_id, slug)
);

create table if not exists public.deal_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.property_type_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  mapped_property_type_id uuid references public.property_types(id) on delete cascade,
  mapped_property_subtype_id uuid references public.property_subtypes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_property_subtypes_type
  on public.property_subtypes(property_type_id);
create index if not exists idx_property_aliases_alias
  on public.property_type_aliases(lower(alias));

alter table public.property_types enable row level security;
alter table public.property_subtypes enable row level security;
alter table public.deal_types enable row level security;
alter table public.property_type_aliases enable row level security;

-- Policies worden alleen aangemaakt wanneer ze nog ontbreken.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_types' and policyname='Intern leest property_types') then
    create policy "Intern leest property_types" on public.property_types
      for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_types' and policyname='Admin beheert property_types ins') then
    create policy "Admin beheert property_types ins" on public.property_types
      for insert to authenticated with check (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_types' and policyname='Admin beheert property_types upd') then
    create policy "Admin beheert property_types upd" on public.property_types
      for update to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_types' and policyname='Admin beheert property_types del') then
    create policy "Admin beheert property_types del" on public.property_types
      for delete to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_subtypes' and policyname='Intern leest property_subtypes') then
    create policy "Intern leest property_subtypes" on public.property_subtypes
      for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_subtypes' and policyname='Admin beheert property_subtypes ins') then
    create policy "Admin beheert property_subtypes ins" on public.property_subtypes
      for insert to authenticated with check (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_subtypes' and policyname='Admin beheert property_subtypes upd') then
    create policy "Admin beheert property_subtypes upd" on public.property_subtypes
      for update to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_subtypes' and policyname='Admin beheert property_subtypes del') then
    create policy "Admin beheert property_subtypes del" on public.property_subtypes
      for delete to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deal_types' and policyname='Intern leest deal_types') then
    create policy "Intern leest deal_types" on public.deal_types
      for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deal_types' and policyname='Admin beheert deal_types ins') then
    create policy "Admin beheert deal_types ins" on public.deal_types
      for insert to authenticated with check (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deal_types' and policyname='Admin beheert deal_types upd') then
    create policy "Admin beheert deal_types upd" on public.deal_types
      for update to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='deal_types' and policyname='Admin beheert deal_types del') then
    create policy "Admin beheert deal_types del" on public.deal_types
      for delete to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_type_aliases' and policyname='Intern leest property_type_aliases') then
    create policy "Intern leest property_type_aliases" on public.property_type_aliases
      for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_type_aliases' and policyname='Admin beheert property_type_aliases ins') then
    create policy "Admin beheert property_type_aliases ins" on public.property_type_aliases
      for insert to authenticated with check (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_type_aliases' and policyname='Admin beheert property_type_aliases upd') then
    create policy "Admin beheert property_type_aliases upd" on public.property_type_aliases
      for update to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_type_aliases' and policyname='Admin beheert property_type_aliases del') then
    create policy "Admin beheert property_type_aliases del" on public.property_type_aliases
      for delete to authenticated using (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
end
$$;

alter table public.objecten
  add column if not exists property_type_id uuid references public.property_types(id) on delete set null,
  add column if not exists property_subtype_ids uuid[] not null default '{}'::uuid[],
  add column if not exists deal_type_ids uuid[] not null default '{}'::uuid[];

alter table public.zoekprofielen
  add column if not exists property_type_ids uuid[] not null default '{}'::uuid[],
  add column if not exists property_subtype_ids_v2 uuid[] not null default '{}'::uuid[],
  add column if not exists deal_type_ids uuid[] not null default '{}'::uuid[];

alter table public.relaties
  add column if not exists property_type_ids uuid[] not null default '{}'::uuid[],
  add column if not exists property_subtype_ids uuid[] not null default '{}'::uuid[],
  add column if not exists deal_type_ids uuid[] not null default '{}'::uuid[];

create index if not exists idx_objecten_property_type on public.objecten(property_type_id);
create index if not exists idx_objecten_property_subtypes on public.objecten using gin(property_subtype_ids);
create index if not exists idx_objecten_deal_types on public.objecten using gin(deal_type_ids);
create index if not exists idx_zoekprofielen_property_types on public.zoekprofielen using gin(property_type_ids);
create index if not exists idx_zoekprofielen_property_subtypes_v2 on public.zoekprofielen using gin(property_subtype_ids_v2);
create index if not exists idx_zoekprofielen_deal_types on public.zoekprofielen using gin(deal_type_ids);
create index if not exists idx_relaties_property_types on public.relaties using gin(property_type_ids);
create index if not exists idx_relaties_property_subtypes on public.relaties using gin(property_subtype_ids);

-- Geen INSERT/seeddata in deze draft.

commit;
