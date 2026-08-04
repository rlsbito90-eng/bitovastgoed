-- App-brede Kadasterkosten: productcatalogus, configureerbare budgetten en auditbare kosten-events.
-- Deze migratie voert geen Kadaster-aanvragen uit en bevat geen API-credentials.
-- Vereist public.is_app_admin() uit de objectidentiteitsmigratie.

create table if not exists public.kadaster_producten (
  code text primary key,
  naam text not null,
  categorie text not null check (categorie in ('gratis','betaald')),
  tarief_per_eenheid numeric(12,4),
  valuta text not null default 'EUR',
  actief boolean not null default false,
  bevestiging_verplicht boolean not null default true,
  tarief_geldig_vanaf date,
  bron_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.kadaster_budgetten (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('bedrijf','gebruiker','campagne','module')),
  scope_id text not null,
  daglimiet numeric(12,2),
  maandlimiet numeric(12,2),
  bevestiging_vanaf numeric(12,2),
  harde_blokkade boolean not null default false,
  beheerder_override boolean not null default true,
  waarschuwing_percentages integer[] not null default array[70,85,100],
  geldig_vanaf date not null default current_date,
  geldig_tot date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(scope_type, scope_id, geldig_vanaf)
);

create table if not exists public.kadaster_kosten_events (
  id uuid primary key default gen_random_uuid(),
  product_code text not null references public.kadaster_producten(code),
  status text not null check (status in ('geraamd','bevestigd','geleverd','gedeeltelijk_geleverd','mislukt','geannuleerd','hergebruikt')),
  bron_module text not null check (bron_module in ('vastgoedkansen','off_market_radar','objecten','acquisitie','deals','pandenverkenner','snelle_pandcheck','referentieobjecten','vastgoedrekenen','overig')),
  bron_record_type text,
  bron_record_id text,
  aantal_eenheden integer not null default 1 check (aantal_eenheden > 0),
  geraamde_kosten numeric(12,2) not null default 0,
  werkelijke_kosten numeric(12,2),
  valuta text not null default 'EUR',
  gebruiker_id uuid not null references auth.users(id),
  crm_objectregistratie_id uuid references public.crm_objectregistraties(id),
  vastgoedkans_id uuid,
  object_id uuid,
  campagne_id uuid,
  adres_label text,
  externe_request_id text,
  hergebruikt_van_event_id uuid references public.kadaster_kosten_events(id),
  aangevraagd_op timestamptz not null default now(),
  geleverd_op timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists kadaster_kosten_events_periode_idx on public.kadaster_kosten_events(aangevraagd_op desc);
create index if not exists kadaster_kosten_events_product_idx on public.kadaster_kosten_events(product_code, aangevraagd_op desc);
create index if not exists kadaster_kosten_events_module_idx on public.kadaster_kosten_events(bron_module, aangevraagd_op desc);
create index if not exists kadaster_kosten_events_gebruiker_idx on public.kadaster_kosten_events(gebruiker_id, aangevraagd_op desc);
create index if not exists kadaster_kosten_events_object_idx on public.kadaster_kosten_events(crm_objectregistratie_id, aangevraagd_op desc);

alter table public.kadaster_producten enable row level security;
alter table public.kadaster_budgetten enable row level security;
alter table public.kadaster_kosten_events enable row level security;

create policy "authenticated leest kadasterproducten" on public.kadaster_producten
for select to authenticated using (true);
create policy "authenticated leest kadasterbudgetten" on public.kadaster_budgetten
for select to authenticated using (true);
create policy "authenticated leest kadasterkosten" on public.kadaster_kosten_events
for select to authenticated using (true);

create policy "admin beheert kadasterproducten" on public.kadaster_producten
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admin beheert kadasterbudgetten" on public.kadaster_budgetten
for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Kosten-events worden later uitsluitend via een beveiligde app-brede servergateway geschreven.
-- Browserrollen krijgen bewust geen INSERT/UPDATE/DELETE-policy.

insert into public.kadaster_producten(code, naam, categorie, actief, bevestiging_verplicht)
values
  ('objectinformatie_algemeen','Objectinformatie algemeen','gratis',false,false),
  ('contractloos','Contractloos','betaald',false,true),
  ('rechten','Rechteninformatie','betaald',false,true),
  ('koopsom','Koopsom','betaald',false,true),
  ('omgeving','Omgevingsinformatie','betaald',false,true),
  ('woz','WOZ-informatie','betaald',false,true)
on conflict (code) do nothing;
