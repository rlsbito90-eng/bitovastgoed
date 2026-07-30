-- Fase 6D.2: gecontroleerde bronimport voor CSV-, XLS- en XLSX-bronbestanden.
--
-- Veiligheidscontract:
-- - uitsluitend import in een regulier conceptbronpakket;
-- - append-only: bestaande registercodes worden nooit bijgewerkt;
-- - volledige import is atomair, één ongeldige rij rolt alles terug;
-- - bestandshash + werkblad voorkomen dubbele import;
-- - kritieke validatie wordt server-side herhaald;
-- - import past nooit automatisch waarden op scenario's toe.

create table if not exists public.vastgoedrekenen_bronimport_runs (
  id uuid primary key default gen_random_uuid(),
  bronpakket_id uuid not null references public.vastgoedrekenen_bronpakketten(id) on delete restrict,
  bestand_naam text not null,
  bestand_type text not null,
  bestand_grootte bigint not null,
  bestand_sha256 text not null,
  werkblad text,
  kolom_mapping jsonb not null,
  validatie_samenvatting jsonb not null,
  rij_aantal integer not null,
  geimporteerd_aantal integer not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vastgoedrekenen_bronimport_type_check check (bestand_type in ('csv', 'xls', 'xlsx')),
  constraint vastgoedrekenen_bronimport_size_check check (bestand_grootte >= 0 and bestand_grootte <= 10485760),
  constraint vastgoedrekenen_bronimport_hash_check check (bestand_sha256 ~ '^[0-9a-f]{64}$'),
  constraint vastgoedrekenen_bronimport_count_check check (
    rij_aantal > 0 and rij_aantal <= 1000 and geimporteerd_aantal = rij_aantal
  ),
  constraint vastgoedrekenen_bronimport_file_sheet_key unique (bronpakket_id, bestand_sha256, werkblad)
);

create index if not exists vastgoedrekenen_bronimport_package_created_idx
  on public.vastgoedrekenen_bronimport_runs(bronpakket_id, created_at desc);

alter table public.vastgoedrekenen_bronimport_runs enable row level security;

drop policy if exists "Authenticated users can read vastgoedrekenen bronimports"
  on public.vastgoedrekenen_bronimport_runs;
create policy "Authenticated users can read vastgoedrekenen bronimports"
  on public.vastgoedrekenen_bronimport_runs
  for select to authenticated
  using (true);

-- Er is bewust geen directe insert/update/delete-policy. Nieuwe auditregels ontstaan
-- uitsluitend via de transactionele security-definerfunctie hieronder.

create or replace function public.vastgoedrekenen_import_codes_valid(
  p_dimension text,
  p_codes jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_codes is null then true
    when jsonb_typeof(p_codes) <> 'array' then false
    else not exists (
      select 1
      from jsonb_array_elements_text(p_codes) as code(value)
      where not exists (
        select 1
        from public.vastgoedrekenen_taxonomie_opties option
        where option.dimension_code = p_dimension
          and option.option_code = code.value
          and option.active
      )
    )
  end;
$$;

create or replace function public.vastgoedrekenen_import_kengetallen(
  p_bronpakket_id uuid,
  p_bestand jsonb,
  p_kolom_mapping jsonb,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_package public.vastgoedrekenen_bronpakketten%rowtype;
  v_row jsonb;
  v_row_count integer;
  v_distinct_code_count integer;
  v_imported integer := 0;
  v_run_id uuid;
  v_code text;
  v_name text;
  v_category text;
  v_unit_code text;
  v_vat_code text;
  v_scenario_field text;
  v_conservative_band text;
  v_optimistic_band text;
  v_minimum numeric;
  v_basis numeric;
  v_maximum numeric;
  v_location_keys text[];
  v_file_name text := nullif(btrim(p_bestand->>'bestand_naam'), '');
  v_file_type text := lower(nullif(btrim(p_bestand->>'bestand_type'), ''));
  v_file_size bigint;
  v_file_hash text := lower(nullif(btrim(p_bestand->>'bestand_sha256'), ''));
  v_sheet text := nullif(btrim(p_bestand->>'werkblad'), '');
  v_validation jsonb := coalesce(p_bestand->'validatie_samenvatting', '{}'::jsonb);
begin
  if v_actor is null then
    raise exception 'Bronimport vereist een aangemelde gebruiker.';
  end if;

  select * into v_package
  from public.vastgoedrekenen_bronpakketten
  where id = p_bronpakket_id
  for update;

  if not found then
    raise exception 'Bronpakket bestaat niet.';
  end if;
  if v_package.status <> 'concept' or v_package.system_managed then
    raise exception 'Importeren kan uitsluitend in een regulier conceptbronpakket.';
  end if;
  if v_package.prijspeildatum is null or v_package.geldig_vanaf is null or v_package.vervaldatum is null then
    raise exception 'Bronpakket mist prijspeil- of geldigheidsdata.';
  end if;

  if jsonb_typeof(p_bestand) <> 'object' or jsonb_typeof(p_kolom_mapping) <> 'object' then
    raise exception 'Bestandsmetadata of kolomkoppeling is ongeldig.';
  end if;
  if v_file_name is null or v_file_type is null or v_file_type not in ('csv', 'xls', 'xlsx') then
    raise exception 'Bestandsnaam of bestandstype is ongeldig.';
  end if;
  if jsonb_typeof(p_bestand->'bestand_grootte') <> 'number' then
    raise exception 'Bestandsgrootte ontbreekt of is ongeldig.';
  end if;
  v_file_size := (p_bestand->>'bestand_grootte')::bigint;
  if v_file_size < 0 or v_file_size > 10485760 then
    raise exception 'Bestandsgrootte valt buiten de toegestane grens van 10 MB.';
  end if;
  if v_file_hash is null or v_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'SHA-256-bestandshash ontbreekt of is ongeldig.';
  end if;

  if exists (
    select 1 from public.vastgoedrekenen_bronimport_runs run
    where run.bronpakket_id = p_bronpakket_id
      and run.bestand_sha256 = v_file_hash
      and run.werkblad is not distinct from v_sheet
  ) then
    raise exception 'Dit bestand en werkblad zijn al in dit bronpakket geïmporteerd.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Importregels moeten als een JSON-array worden aangeleverd.';
  end if;
  v_row_count := jsonb_array_length(p_rows);
  if v_row_count < 1 or v_row_count > 1000 then
    raise exception 'Een import moet tussen 1 en 1000 regels bevatten.';
  end if;

  select count(distinct lower(btrim(value->>'code')))
    into v_distinct_code_count
  from jsonb_array_elements(p_rows) item(value);
  if v_distinct_code_count <> v_row_count then
    raise exception 'Het importbestand bevat lege of dubbele registercodes.';
  end if;

  -- Valideer alle regels eerst. Inserts volgen pas wanneer de volledige set schoon is.
  for v_row in select value from jsonb_array_elements(p_rows) item(value)
  loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'Een importregel is geen object.';
    end if;

    v_code := lower(nullif(btrim(v_row->>'code'), ''));
    v_name := nullif(btrim(v_row->>'naam'), '');
    v_category := nullif(btrim(v_row->>'categorie'), '');
    v_unit_code := nullif(btrim(v_row->>'unit_code'), '');
    v_vat_code := nullif(btrim(v_row->>'vat_treatment_code'), '');
    v_scenario_field := nullif(btrim(v_row->>'scenario_veld'), '');
    v_conservative_band := nullif(btrim(v_row->>'conservative_band'), '');
    v_optimistic_band := nullif(btrim(v_row->>'optimistic_band'), '');

    if v_code is null or v_code !~ '^[a-z0-9][a-z0-9_]*$' then
      raise exception 'Registercode is leeg of ongeldig.';
    end if;
    if v_name is null then
      raise exception 'Naam ontbreekt bij registercode %.', v_code;
    end if;
    if nullif(btrim(v_row->>'eenheid'), '') is null then
      raise exception 'Leesbare eenheid ontbreekt bij registercode %.', v_code;
    end if;
    if v_category not in ('rendement', 'opbrengst', 'bouwkosten', 'projectkosten', 'verkoopkosten', 'exploitatie', 'fiscaal', 'methodologie', 'overig') then
      raise exception 'Categorie is ongeldig bij registercode %.', v_code;
    end if;
    if exists (select 1 from public.vastgoedrekenen_kengetallen where lower(code) = v_code) then
      raise exception 'Registercode % bestaat al. Bestaande regels worden nooit automatisch overschreven.', v_code;
    end if;

    if jsonb_typeof(v_row->'minimum_waarde') <> 'number'
      or jsonb_typeof(v_row->'basis_waarde') <> 'number'
      or jsonb_typeof(v_row->'maximum_waarde') <> 'number'
    then
      raise exception 'Bandbreedte bevat geen geldige getallen bij registercode %.', v_code;
    end if;
    v_minimum := (v_row->>'minimum_waarde')::numeric;
    v_basis := (v_row->>'basis_waarde')::numeric;
    v_maximum := (v_row->>'maximum_waarde')::numeric;
    if not (v_minimum <= v_basis and v_basis <= v_maximum) then
      raise exception 'Bandbreedte voldoet niet aan minimum ≤ basis ≤ maximum bij registercode %.', v_code;
    end if;

    if v_unit_code is null or not exists (
      select 1 from public.vastgoedrekenen_taxonomie_opties
      where dimension_code = 'unit' and option_code = v_unit_code and active
    ) then
      raise exception 'Eenheid ontbreekt of is niet actief bij registercode %.', v_code;
    end if;
    if v_vat_code is not null and not exists (
      select 1 from public.vastgoedrekenen_taxonomie_opties
      where dimension_code = 'vat_treatment' and option_code = v_vat_code and active
    ) then
      raise exception 'Btw-behandeling is ongeldig bij registercode %.', v_code;
    end if;
    if (v_unit_code = 'eur' or left(v_unit_code, 4) = 'eur_') and v_vat_code is null then
      raise exception 'Eurogrondslag vereist een btw-behandeling bij registercode %.', v_code;
    end if;

    if v_scenario_field is not null and v_scenario_field not in (
      'sale_target_margin_percentage', 'sale_target_roi_percentage', 'sale_target_margin_amount',
      'sale_costs_percentage', 'unforeseen_percentage', 'target_bar', 'vacancy_percentage',
      'operating_cost_percentage', 'maintenance_reserve_percentage', 'management_cost_percentage'
    ) then
      raise exception 'Scenario-koppeling is ongeldig bij registercode %.', v_code;
    end if;
    if v_conservative_band is not null and v_conservative_band not in ('minimum', 'basis', 'maximum') then
      raise exception 'Conservatieve profielband is ongeldig bij registercode %.', v_code;
    end if;
    if v_optimistic_band is not null and v_optimistic_band not in ('minimum', 'basis', 'maximum') then
      raise exception 'Optimistische profielband is ongeldig bij registercode %.', v_code;
    end if;

    if not public.vastgoedrekenen_import_codes_valid('asset_type', v_row->'asset_type_codes')
      or not public.vastgoedrekenen_import_codes_valid('strategy', v_row->'strategy_codes')
      or not public.vastgoedrekenen_import_codes_valid('project_phase', v_row->'project_phase_codes')
      or not public.vastgoedrekenen_import_codes_valid('risk_class', v_row->'risk_class_codes')
      or not public.vastgoedrekenen_import_codes_valid('quality_level', v_row->'quality_level_codes')
      or not public.vastgoedrekenen_import_codes_valid('complexity', v_row->'complexity_codes')
      or not public.vastgoedrekenen_import_codes_valid('location_type', v_row->'location_type_codes')
      or not public.vastgoedrekenen_import_codes_valid('market_condition', v_row->'market_condition_codes')
      or not public.vastgoedrekenen_import_codes_valid('scenario_profile', v_row->'scenario_profile_codes')
    then
      raise exception 'Een classificatiecode is ongeldig of inactief bij registercode %.', v_code;
    end if;

    if v_row->'location_keys' is not null and jsonb_typeof(v_row->'location_keys') <> 'array' then
      raise exception 'Gebiedssleutels zijn ongeldig bij registercode %.', v_code;
    end if;
    v_location_keys := array(
      select distinct value from jsonb_array_elements_text(coalesce(v_row->'location_keys', '[]'::jsonb)) item(value)
    );
    if cardinality(v_location_keys) = 0 then
      v_location_keys := v_package.location_keys;
    elsif exists (
      select 1 from unnest(v_location_keys) key
      where not (key = any(v_package.location_keys))
    ) then
      raise exception 'Gebiedssleutel valt buiten de officiële scope van het bronpakket bij registercode %.', v_code;
    end if;
  end loop;

  -- Volledige set is schoon; voeg de regels nu toe binnen dezelfde transactie.
  for v_row in select value from jsonb_array_elements(p_rows) item(value)
  loop
    v_code := lower(btrim(v_row->>'code'));
    v_unit_code := btrim(v_row->>'unit_code');
    v_location_keys := array(
      select distinct value from jsonb_array_elements_text(coalesce(v_row->'location_keys', '[]'::jsonb)) item(value)
    );
    if cardinality(v_location_keys) = 0 then
      v_location_keys := v_package.location_keys;
    end if;

    insert into public.vastgoedrekenen_kengetallen (
      code, naam, categorie, eenheid,
      minimum_waarde, basis_waarde, maximum_waarde,
      conservative_band, optimistic_band, scenario_veld,
      bron_type, bron_naam, bron_referentie, bron_peildatum, geldig_vanaf, vervaldatum,
      toepassingsgebied, regio, projectfase, risicoklasse,
      betrouwbaarheid, toelichting, actief, versie,
      asset_type_codes, strategy_codes, project_phase_codes, risk_class_codes,
      quality_level_codes, complexity_codes, location_type_codes, market_condition_codes,
      scenario_profile_codes, location_keys, unit_code, vat_treatment_code,
      classification_schema_version, bronpakket_id, created_by
    ) values (
      v_code,
      btrim(v_row->>'naam'),
      btrim(v_row->>'categorie'),
      btrim(v_row->>'eenheid'),
      (v_row->>'minimum_waarde')::numeric,
      (v_row->>'basis_waarde')::numeric,
      (v_row->>'maximum_waarde')::numeric,
      nullif(btrim(v_row->>'conservative_band'), ''),
      nullif(btrim(v_row->>'optimistic_band'), ''),
      nullif(btrim(v_row->>'scenario_veld'), ''),
      v_package.bron_type,
      v_package.bron_naam,
      v_package.bron_referentie,
      v_package.prijspeildatum,
      v_package.geldig_vanaf,
      v_package.vervaldatum,
      '{}', '{}', '{}', '{}',
      v_package.betrouwbaarheid,
      nullif(btrim(v_row->>'toelichting'), ''),
      true,
      1,
      array(select value from jsonb_array_elements_text(coalesce(v_row->'asset_type_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'strategy_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'project_phase_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'risk_class_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'quality_level_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'complexity_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'location_type_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'market_condition_codes', '[]'::jsonb)) item(value)),
      array(select value from jsonb_array_elements_text(coalesce(v_row->'scenario_profile_codes', '[]'::jsonb)) item(value)),
      v_location_keys,
      v_unit_code,
      nullif(btrim(v_row->>'vat_treatment_code'), ''),
      coalesce((v_row->>'classification_schema_version')::integer, 1),
      v_package.id,
      v_actor
    );
    v_imported := v_imported + 1;
  end loop;

  insert into public.vastgoedrekenen_bronimport_runs (
    bronpakket_id, bestand_naam, bestand_type, bestand_grootte, bestand_sha256,
    werkblad, kolom_mapping, validatie_samenvatting, rij_aantal, geimporteerd_aantal, created_by
  ) values (
    v_package.id, v_file_name, v_file_type, v_file_size, v_file_hash,
    v_sheet, p_kolom_mapping, v_validation, v_row_count, v_imported, v_actor
  ) returning id into v_run_id;

  return jsonb_build_object('import_run_id', v_run_id, 'imported_count', v_imported);
end;
$$;

revoke all on function public.vastgoedrekenen_import_kengetallen(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.vastgoedrekenen_import_kengetallen(uuid, jsonb, jsonb, jsonb) to authenticated;

revoke all on function public.vastgoedrekenen_import_codes_valid(text, jsonb) from public;
