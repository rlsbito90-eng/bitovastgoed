-- Fase 6D.3: herbruikbare kolommappings voor gecontroleerde bronimport.
--
-- Mappingprofielen bevatten uitsluitend bronkolomnamen en veldkoppelingen.
-- Zij bevatten geen kengetalwaarden, wijzigen geen bronpakket en passen niets op scenario's toe.

create or replace function public.vastgoedrekenen_bronimport_mapping_geldig(p_kolommen jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(p_kolommen) = 'object'
    and (select count(*) from jsonb_each(p_kolommen)) between 7 and 22
    and p_kolommen ?& array[
      'code', 'naam', 'categorie', 'unit_code',
      'minimum_waarde', 'basis_waarde', 'maximum_waarde'
    ]
    and not exists (
      select 1
      from jsonb_each(p_kolommen) item(key, value)
      where item.key not in (
        'code', 'naam', 'categorie', 'unit_code',
        'minimum_waarde', 'basis_waarde', 'maximum_waarde',
        'vat_treatment_code', 'scenario_veld', 'conservative_band', 'optimistic_band',
        'asset_type_codes', 'strategy_codes', 'project_phase_codes', 'risk_class_codes',
        'quality_level_codes', 'complexity_codes', 'location_type_codes',
        'market_condition_codes', 'scenario_profile_codes', 'location_keys', 'toelichting'
      )
      or jsonb_typeof(item.value) <> 'string'
      or btrim(item.value #>> '{}') = ''
    )
    and (
      select count(distinct lower(regexp_replace(item.value #>> '{}', '[^a-zA-Z0-9]+', '', 'g')))
      from jsonb_each(p_kolommen) item(key, value)
    ) = (select count(*) from jsonb_each(p_kolommen));
$$;

create table if not exists public.vastgoedrekenen_bronimport_mapping_profielen (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  bron_naam text,
  kolommen jsonb not null,
  actief boolean not null default true,
  system_managed boolean not null default false,
  schema_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vastgoedrekenen_bronimport_mapping_naam_check check (btrim(naam) <> ''),
  constraint vastgoedrekenen_bronimport_mapping_bron_check check (bron_naam is null or btrim(bron_naam) <> ''),
  constraint vastgoedrekenen_bronimport_mapping_schema_check check (schema_version = 1),
  constraint vastgoedrekenen_bronimport_mapping_inhoud_check check (
    public.vastgoedrekenen_bronimport_mapping_geldig(kolommen)
  )
);

create unique index if not exists vastgoedrekenen_bronimport_mapping_owner_name_unique
  on public.vastgoedrekenen_bronimport_mapping_profielen(created_by, lower(btrim(naam)))
  where actief;

create index if not exists vastgoedrekenen_bronimport_mapping_source_idx
  on public.vastgoedrekenen_bronimport_mapping_profielen(lower(bron_naam), naam)
  where actief;

create or replace function public.vastgoedrekenen_bronimport_mapping_actor_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Een mappingprofiel vereist een aangemelde gebruiker.';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := v_actor;
    new.system_managed := false;
    new.schema_version := 1;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if old.system_managed then
    raise exception 'Een systeembeheerd mappingprofiel kan niet worden gewijzigd.';
  end if;
  if old.created_by is distinct from v_actor then
    raise exception 'Alleen de maker kan dit mappingprofiel wijzigen.';
  end if;

  new.created_by := old.created_by;
  new.system_managed := old.system_managed;
  new.schema_version := old.schema_version;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vastgoedrekenen_bronimport_mapping_actor_guard_trigger
  on public.vastgoedrekenen_bronimport_mapping_profielen;
create trigger vastgoedrekenen_bronimport_mapping_actor_guard_trigger
before insert or update on public.vastgoedrekenen_bronimport_mapping_profielen
for each row execute function public.vastgoedrekenen_bronimport_mapping_actor_guard();

alter table public.vastgoedrekenen_bronimport_mapping_profielen enable row level security;

drop policy if exists "Authenticated users can read source import mapping profiles"
  on public.vastgoedrekenen_bronimport_mapping_profielen;
create policy "Authenticated users can read source import mapping profiles"
  on public.vastgoedrekenen_bronimport_mapping_profielen
  for select to authenticated
  using (actief);

drop policy if exists "Authenticated users can create own source import mapping profiles"
  on public.vastgoedrekenen_bronimport_mapping_profielen;
create policy "Authenticated users can create own source import mapping profiles"
  on public.vastgoedrekenen_bronimport_mapping_profielen
  for insert to authenticated
  with check (created_by = auth.uid() and not system_managed);

drop policy if exists "Authenticated users can update own source import mapping profiles"
  on public.vastgoedrekenen_bronimport_mapping_profielen;
create policy "Authenticated users can update own source import mapping profiles"
  on public.vastgoedrekenen_bronimport_mapping_profielen
  for update to authenticated
  using (created_by = auth.uid() and not system_managed)
  with check (created_by = auth.uid() and not system_managed);

revoke all on function public.vastgoedrekenen_bronimport_mapping_geldig(jsonb) from public;
grant execute on function public.vastgoedrekenen_bronimport_mapping_geldig(jsonb) to authenticated;
