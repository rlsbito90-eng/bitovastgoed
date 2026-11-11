-- Bito CRM — herkomstrollen en werkelijke aanlevermomenten
-- Uitbreiding naast bestaand objecten.eigenaar_relatie_id; geen automatische
-- overname van vrije verkopersnamen of interpretatie als juridisch eigendom.

create table if not exists public.object_betrokken_partijen (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objecten(id) on delete cascade,
  relatie_id uuid not null references public.relaties(id) on delete restrict,
  rol text not null check (rol in (
    'juridisch_eigenaar', 'verkoper', 'aanbrenger',
    'verkopend_makelaar', 'beheerder', 'adviseur', 'overig'
  )),
  betrokken_vanaf date null,
  toelichting text null,
  created_at timestamptz not null default now(),
  aangemaakt_door uuid null default auth.uid(),
  constraint object_betrokken_partijen_uniek unique (object_id, relatie_id, rol)
);

create index if not exists object_betrokken_partijen_relatie_idx
  on public.object_betrokken_partijen (relatie_id,created_at desc);
create index if not exists object_betrokken_partijen_object_idx
  on public.object_betrokken_partijen (object_id,created_at desc);

create table if not exists public.object_aanlevermomenten (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objecten(id) on delete cascade,
  relatie_id uuid not null references public.relaties(id) on delete restrict,
  aangeleverd_op date not null,
  kanaal text not null default 'onbekend' check (kanaal in (
    'telefoon','whatsapp','email','website','linkedin','persoonlijk',
    'via_makelaar','anders','onbekend'
  )),
  toelichting text null,
  created_at timestamptz not null default now(),
  aangemaakt_door uuid null default auth.uid()
);

create index if not exists object_aanlevermomenten_relatie_idx
  on public.object_aanlevermomenten (relatie_id,aangeleverd_op desc);
create index if not exists object_aanlevermomenten_object_idx
  on public.object_aanlevermomenten (object_id,aangeleverd_op desc);

alter table public.object_betrokken_partijen enable row level security;
alter table public.object_aanlevermomenten enable row level security;

revoke all on table public.object_betrokken_partijen from public,anon;
revoke all on table public.object_aanlevermomenten from public,anon;
grant select, insert, update, delete on table
  public.object_betrokken_partijen,public.object_aanlevermomenten
  to authenticated;

-- Bestaand CRM-autorisatiemodel; geen toegang alleen op basis van een
-- willekeurige authenticated sessie zonder intern-recht.
create policy "Intern leest object_betrokken_partijen"
  on public.object_betrokken_partijen
  for select to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))));

create policy "Intern voegt object_betrokken_partijen toe"
  on public.object_betrokken_partijen
  for insert to authenticated
  with check ((select public.is_intern_gebruiker((select auth.uid()))));

create policy "Intern verwijdert object_betrokken_partijen"
  on public.object_betrokken_partijen
  for delete to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))));

create policy "Intern leest object_aanlevermomenten"
  on public.object_aanlevermomenten
  for select to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))));

create policy "Intern voegt object_aanlevermomenten toe"
  on public.object_aanlevermomenten
  for insert to authenticated
  with check ((select public.is_intern_gebruiker((select auth.uid()))));

create policy "Intern verwijdert object_aanlevermomenten"
  on public.object_aanlevermomenten
  for delete to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))));

-- Append-only bronhistorie: correcties verlopen via expliciete verwijdering
-- en opnieuw registreren, zodat oorspronkelijke tijdlijn niet stil wijzigt.
comment on table public.object_betrokken_partijen is
  'Geverifieerde relatie-rollen per CRM object; juridische eigenaar niet uit legacy FK afleiden.';
comment on table public.object_aanlevermomenten is
  'Werkelijke aanlevergebeurtenissen; aangeleverd_op is niet objecten.created_at.';
