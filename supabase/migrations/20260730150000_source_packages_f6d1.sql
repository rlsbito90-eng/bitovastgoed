-- Fase 6D.1: bronpakketten en prijspeilbeheer.
--
-- Doel:
-- - groepeer registerregels onder één controleerbare bron-, versie- en scopecontext;
-- - blokkeer goedkeuring bij onvolledige of onderling strijdige metadata;
-- - vergrendel goedgekeurde pakketmetadata en gekoppelde regels;
-- - bewaar bij een scenario-snapshot automatisch een onveranderlijke pakketkopie.
--
-- Deze migratie wijzigt geen financiële waarde en past geen kengetal op een scenario toe.

create table if not exists public.vastgoedrekenen_bronpakketten (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  versie integer not null default 1,
  naam text not null,
  status text not null default 'concept',
  bron_type text not null,
  bron_naam text not null,
  bron_referentie text,
  bron_versie text,
  prijspeildatum date,
  geldig_vanaf date,
  vervaldatum date,
  valuta_code text not null default 'EUR',
  geografische_scope text,
  location_keys text[] not null default '{}',
  meetgrondslag text,
  scope_inclusief text,
  scope_exclusief text,
  indexeringsmethode text,
  betrouwbaarheid text not null default 'laag',
  toelichting text,
  system_managed boolean not null default false,
  goedgekeurd_door uuid references auth.users(id) on delete set null,
  goedgekeurd_op timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vastgoedrekenen_bronpakketten_code_version_key unique (code, versie),
  constraint vastgoedrekenen_bronpakketten_versie_check check (versie > 0),
  constraint vastgoedrekenen_bronpakketten_status_check check (status in ('concept', 'goedgekeurd', 'gearchiveerd')),
  constraint vastgoedrekenen_bronpakketten_bron_type_check check (
    bron_type in ('extern', 'intern', 'interne_werkhypothese', 'projectspecifiek', 'methodologie')
  ),
  constraint vastgoedrekenen_bronpakketten_betrouwbaarheid_check check (betrouwbaarheid in ('laag', 'middel', 'hoog')),
  constraint vastgoedrekenen_bronpakketten_valuta_check check (valuta_code ~ '^[A-Z]{3}$'),
  constraint vastgoedrekenen_bronpakketten_dates_check check (
    (geldig_vanaf is null or vervaldatum is null or geldig_vanaf <= vervaldatum)
    and (prijspeildatum is null or vervaldatum is null or prijspeildatum <= vervaldatum)
  )
);

alter table public.vastgoedrekenen_bronpakketten enable row level security;

drop policy if exists "Authenticated users can read vastgoedrekenen bronpakketten" on public.vastgoedrekenen_bronpakketten;
create policy "Authenticated users can read vastgoedrekenen bronpakketten"
  on public.vastgoedrekenen_bronpakketten
  for select to authenticated
  using (true);

drop policy if exists "Authenticated users can manage vastgoedrekenen bronpakketten" on public.vastgoedrekenen_bronpakketten;
create policy "Authenticated users can manage vastgoedrekenen bronpakketten"
  on public.vastgoedrekenen_bronpakketten
  for all to authenticated
  using (true)
  with check (true);

alter table public.vastgoedrekenen_kengetallen
  add column if not exists bronpakket_id uuid;

alter table public.scenario_kengetal_snapshots
  add column if not exists bronpakket_id uuid,
  add column if not exists bronpakket_snapshot jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vastgoedrekenen_kengetallen_bronpakket_id_fkey'
  ) then
    alter table public.vastgoedrekenen_kengetallen
      add constraint vastgoedrekenen_kengetallen_bronpakket_id_fkey
      foreign key (bronpakket_id)
      references public.vastgoedrekenen_bronpakketten(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'scenario_kengetal_snapshots_bronpakket_id_fkey'
  ) then
    alter table public.scenario_kengetal_snapshots
      add constraint scenario_kengetal_snapshots_bronpakket_id_fkey
      foreign key (bronpakket_id)
      references public.vastgoedrekenen_bronpakketten(id)
      on delete set null;
  end if;
end $$;

create index if not exists vastgoedrekenen_kengetallen_bronpakket_idx
  on public.vastgoedrekenen_kengetallen(bronpakket_id);
create index if not exists scenario_kengetal_snapshots_bronpakket_idx
  on public.scenario_kengetal_snapshots(bronpakket_id);
create index if not exists vastgoedrekenen_bronpakketten_status_idx
  on public.vastgoedrekenen_bronpakketten(status, vervaldatum);

create or replace function public.vastgoedrekenen_bronpakket_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vastgoedrekenen_bronpakket_touch_updated_at on public.vastgoedrekenen_bronpakketten;
create trigger vastgoedrekenen_bronpakket_touch_updated_at
before update on public.vastgoedrekenen_bronpakketten
for each row execute function public.vastgoedrekenen_bronpakket_touch_updated_at();

create or replace function public.vastgoedrekenen_lock_bronpakket_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_managed or old.status <> 'concept' then
      raise exception 'Alleen een niet-systeembeheerd conceptbronpakket kan worden verwijderd.';
    end if;
    return old;
  end if;

  if old.system_managed then
    if old.status = 'concept'
      and new.status = 'goedgekeurd'
      and (to_jsonb(new) - array['status', 'goedgekeurd_door', 'goedgekeurd_op', 'updated_at'])
        = (to_jsonb(old) - array['status', 'goedgekeurd_door', 'goedgekeurd_op', 'updated_at'])
    then
      return new;
    end if;
    raise exception 'Een systeembeheerd bronpakket kan niet handmatig worden gewijzigd of gearchiveerd.';
  end if;

  if old.status = 'goedgekeurd' then
    if new.status = 'gearchiveerd'
      and (to_jsonb(new) - array['status', 'updated_at']) = (to_jsonb(old) - array['status', 'updated_at'])
    then
      return new;
    end if;
    raise exception 'Een goedgekeurd bronpakket is onveranderlijk. Alleen archiveren zonder overige wijzigingen is toegestaan.';
  end if;

  if old.status = 'gearchiveerd' then
    raise exception 'Een gearchiveerd bronpakket blijft als historische bronversie onveranderlijk.';
  end if;

  return new;
end;
$$;

drop trigger if exists vastgoedrekenen_lock_bronpakket_metadata on public.vastgoedrekenen_bronpakketten;
create trigger vastgoedrekenen_lock_bronpakket_metadata
before update or delete on public.vastgoedrekenen_bronpakketten
for each row execute function public.vastgoedrekenen_lock_bronpakket_metadata();

create or replace function public.vastgoedrekenen_validate_bronpakket_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_count integer;
  invalid_count integer;
begin
  if new.status <> 'goedgekeurd' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'goedgekeurd' then
    return new;
  end if;

  if nullif(btrim(new.code), '') is null
    or nullif(btrim(new.naam), '') is null
    or nullif(btrim(new.bron_type), '') is null
    or nullif(btrim(new.bron_naam), '') is null
    or nullif(btrim(coalesce(new.bron_referentie, '')), '') is null
    or new.prijspeildatum is null
    or new.geldig_vanaf is null
    or new.vervaldatum is null
    or nullif(btrim(coalesce(new.geografische_scope, '')), '') is null
    or nullif(btrim(coalesce(new.meetgrondslag, '')), '') is null
    or nullif(btrim(coalesce(new.scope_inclusief, '')), '') is null
    or nullif(btrim(coalesce(new.scope_exclusief, '')), '') is null
    or nullif(btrim(coalesce(new.indexeringsmethode, '')), '') is null
  then
    raise exception 'Bronpakket kan niet worden goedgekeurd: verplichte bron-, prijspeil- of scopevelden ontbreken.';
  end if;

  if new.geldig_vanaf > new.vervaldatum or new.prijspeildatum > new.vervaldatum then
    raise exception 'Bronpakket kan niet worden goedgekeurd: datumvolgorde is ongeldig.';
  end if;

  if not new.system_managed and new.goedgekeurd_door is null then
    raise exception 'Bronpakket kan niet worden goedgekeurd zonder beoordelaar.';
  end if;

  select count(*) into linked_count
  from public.vastgoedrekenen_kengetallen k
  where k.bronpakket_id = new.id;

  if linked_count = 0 then
    raise exception 'Bronpakket kan niet worden goedgekeurd zonder gekoppelde kengetallen.';
  end if;

  select count(*) into invalid_count
  from public.vastgoedrekenen_kengetallen k
  where k.bronpakket_id = new.id
    and (
      not k.actief
      or k.vervaldatum < current_date
      or k.unit_code is null
      or ((k.unit_code = 'eur' or left(k.unit_code, 4) = 'eur_') and k.vat_treatment_code is null)
      or k.bron_type <> new.bron_type
      or btrim(k.bron_naam) <> btrim(new.bron_naam)
      or k.bron_peildatum <> new.prijspeildatum
      or k.geldig_vanaf is distinct from new.geldig_vanaf
      or k.vervaldatum <> new.vervaldatum
    );

  if invalid_count > 0 then
    raise exception 'Bronpakket kan niet worden goedgekeurd: % gekoppelde kengetallen zijn inactief, verlopen of inhoudelijk inconsistent.', invalid_count;
  end if;

  new.goedgekeurd_op := coalesce(new.goedgekeurd_op, now());
  return new;
end;
$$;

drop trigger if exists vastgoedrekenen_validate_bronpakket_approval on public.vastgoedrekenen_bronpakketten;
create trigger vastgoedrekenen_validate_bronpakket_approval
before insert or update on public.vastgoedrekenen_bronpakketten
for each row execute function public.vastgoedrekenen_validate_bronpakket_approval();

create or replace function public.vastgoedrekenen_lock_approved_package_entries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_status text;
  new_status text;
begin
  if tg_op = 'DELETE' then
    if old.bronpakket_id is not null then
      select status into old_status
      from public.vastgoedrekenen_bronpakketten
      where id = old.bronpakket_id;
      if old_status = 'goedgekeurd' then
        raise exception 'Kengetal behoort tot een goedgekeurd bronpakket. Archiveer het pakket voordat de regel wordt verwijderd.';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.bronpakket_id is not null then
      select status into new_status
      from public.vastgoedrekenen_bronpakketten
      where id = new.bronpakket_id;
      if new_status = 'goedgekeurd' then
        raise exception 'Nieuwe regels kunnen niet aan een reeds goedgekeurd bronpakket worden gekoppeld.';
      end if;
    end if;
    return new;
  end if;

  if old.bronpakket_id is not null then
    select status into old_status
    from public.vastgoedrekenen_bronpakketten
    where id = old.bronpakket_id;
    if old_status = 'goedgekeurd' then
      raise exception 'Kengetal behoort tot een goedgekeurd bronpakket. Archiveer het pakket voordat de regel wordt gewijzigd.';
    end if;
  end if;

  if new.bronpakket_id is not null and new.bronpakket_id is distinct from old.bronpakket_id then
    select status into new_status
    from public.vastgoedrekenen_bronpakketten
    where id = new.bronpakket_id;
    if new_status = 'goedgekeurd' then
      raise exception 'Nieuwe regels kunnen niet aan een reeds goedgekeurd bronpakket worden gekoppeld.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists vastgoedrekenen_lock_approved_package_entries on public.vastgoedrekenen_kengetallen;
create trigger vastgoedrekenen_lock_approved_package_entries
before insert or update or delete on public.vastgoedrekenen_kengetallen
for each row execute function public.vastgoedrekenen_lock_approved_package_entries();

create or replace function public.vastgoedrekenen_snapshot_bronpakket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_package_id uuid;
  package_payload jsonb;
begin
  if new.kengetal_id is null then
    return new;
  end if;

  -- Bij een clone komt de historische JSON expliciet mee en blijft die behouden.
  -- Bij een hernieuwde toepassing (UPDATE) wordt de actuele pakketcontext opnieuw vastgelegd.
  if tg_op = 'INSERT' and new.bronpakket_snapshot is not null then
    return new;
  end if;

  select
    k.bronpakket_id,
    case when p.id is null then null else
      jsonb_build_object(
        'id', p.id,
        'code', p.code,
        'versie', p.versie,
        'naam', p.naam,
        'bron_type', p.bron_type,
        'bron_naam', p.bron_naam,
        'bron_referentie', p.bron_referentie,
        'bron_versie', p.bron_versie,
        'prijspeildatum', p.prijspeildatum,
        'geldig_vanaf', p.geldig_vanaf,
        'vervaldatum', p.vervaldatum,
        'valuta_code', p.valuta_code,
        'geografische_scope', p.geografische_scope,
        'location_keys', p.location_keys,
        'meetgrondslag', p.meetgrondslag,
        'scope_inclusief', p.scope_inclusief,
        'scope_exclusief', p.scope_exclusief,
        'indexeringsmethode', p.indexeringsmethode,
        'betrouwbaarheid', p.betrouwbaarheid,
        'goedgekeurd_op', p.goedgekeurd_op
      )
    end
  into linked_package_id, package_payload
  from public.vastgoedrekenen_kengetallen k
  left join public.vastgoedrekenen_bronpakketten p on p.id = k.bronpakket_id
  where k.id = new.kengetal_id;

  new.bronpakket_id := linked_package_id;
  new.bronpakket_snapshot := package_payload;
  return new;
end;
$$;

drop trigger if exists scenario_kengetal_snapshot_bronpakket on public.scenario_kengetal_snapshots;
create trigger scenario_kengetal_snapshot_bronpakket
before insert or update of kengetal_id on public.scenario_kengetal_snapshots
for each row execute function public.vastgoedrekenen_snapshot_bronpakket();

-- Neem het reeds ingevoerde interne quickscanpakket op in dezelfde governance.
insert into public.vastgoedrekenen_bronpakketten (
  code,
  versie,
  naam,
  status,
  bron_type,
  bron_naam,
  bron_referentie,
  bron_versie,
  prijspeildatum,
  geldig_vanaf,
  vervaldatum,
  valuta_code,
  geografische_scope,
  location_keys,
  meetgrondslag,
  scope_inclusief,
  scope_exclusief,
  indexeringsmethode,
  betrouwbaarheid,
  toelichting,
  system_managed
)
values (
  'bito_quickscan_internal',
  1,
  'Bito quickscan — interne exploitatieaannames',
  'concept',
  'interne_werkhypothese',
  'Bito Vastgoed — bestaand aannameprofiel V1',
  'src/lib/vastgoedrekenen/profiles.ts; geformaliseerd in Fase 6C',
  'V1',
  date '2026-07-30',
  date '2026-07-30',
  date '2027-01-30',
  'EUR',
  'Algemeen Nederland; niet gebiedsspecifiek en geen marktbenchmark.',
  '{}'::text[],
  'Percentage van de gekoppelde scenariogrondslag per exploitatieveld.',
  'Leegstand, exploitatiekosten, onderhoudsreserve en beheerkosten voor zeven quickscan-assetprofielen.',
  'Markthuren, bouwkosten, yields, projectspecifieke risico’s en het profiel zwaar/risicovol.',
  'Niet indexeren. Voor de vervaldatum inhoudelijk herijken en vervangen door actuele externe of projectspecifieke bronnen.',
  'laag',
  'Systeembeheerd pakket dat uitsluitend bestaand CRM-gedrag centraliseert. Goedkeuring betekent traceerbaarheid, niet marktconformiteit.',
  true
)
on conflict (code, versie) do nothing;

update public.vastgoedrekenen_kengetallen k
set bronpakket_id = p.id
from public.vastgoedrekenen_bronpakketten p
where p.code = 'bito_quickscan_internal'
  and p.versie = 1
  and p.status = 'concept'
  and k.code like 'bito_quickscan_v1\_%' escape '\'
  and k.bronpakket_id is null;

update public.vastgoedrekenen_bronpakketten p
set
  status = 'goedgekeurd',
  goedgekeurd_op = coalesce(p.goedgekeurd_op, now())
where p.code = 'bito_quickscan_internal'
  and p.versie = 1
  and p.status = 'concept';
