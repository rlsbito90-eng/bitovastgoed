-- Fase 6A: gecontroleerde taxonomie voor het kengetallenregister en
-- officiële gebiedsvoorkeuren op provincie-, gemeente-, wijk- en buurtniveau.
-- Additief: bestaande kengetallen, snapshots en signalen worden niet gewijzigd.

create table if not exists public.vastgoedrekenen_taxonomie_opties (
  id uuid primary key default gen_random_uuid(),
  dimension_code text not null,
  option_code text not null,
  label text not null,
  parent_dimension_code text null,
  parent_option_code text null,
  description text null,
  sort_order integer not null default 0,
  active boolean not null default true,
  version integer not null default 1,
  system_managed boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vastgoedrekenen_taxonomie_opties_unique unique (dimension_code, option_code),
  constraint vastgoedrekenen_taxonomie_dimension_check check (dimension_code in (
    'asset_type','strategy','project_phase','risk_class','quality_level','complexity',
    'location_type','unit','vat_treatment','market_condition','scenario_profile'
  )),
  constraint vastgoedrekenen_taxonomie_version_check check (version > 0),
  constraint vastgoedrekenen_taxonomie_parent_check check (
    (parent_dimension_code is null and parent_option_code is null)
    or (parent_dimension_code is not null and parent_option_code is not null)
  )
);

alter table public.vastgoedrekenen_taxonomie_opties enable row level security;

drop policy if exists "Authenticated users can read vastgoedrekenen taxonomy" on public.vastgoedrekenen_taxonomie_opties;
create policy "Authenticated users can read vastgoedrekenen taxonomy"
  on public.vastgoedrekenen_taxonomie_opties for select to authenticated using (true);

drop policy if exists "Authenticated users can manage vastgoedrekenen taxonomy" on public.vastgoedrekenen_taxonomie_opties;
create policy "Authenticated users can manage vastgoedrekenen taxonomy"
  on public.vastgoedrekenen_taxonomie_opties for all to authenticated using (true) with check (true);

insert into public.vastgoedrekenen_taxonomie_opties
  (dimension_code, option_code, label, description, sort_order)
values
  ('asset_type','residential','Wonen','Woningen, appartementen en woongebouwen.',10),
  ('asset_type','office','Kantoor','Kantoren en administratieve bedrijfsgebouwen.',20),
  ('asset_type','retail','Winkel','Winkels en overige detailhandel.',30),
  ('asset_type','hospitality','Horeca','Restaurant, café en overige horeca.',40),
  ('asset_type','hotel','Hotel','Hotels en short-stay exploitatie.',50),
  ('asset_type','logistics','Logistiek','Distributiecentra en logistieke hallen.',60),
  ('asset_type','light_industrial','Light industrial','Kleinschalige bedrijfsruimte en productie.',70),
  ('asset_type','care','Zorg','Zorgvastgoed en maatschappelijke zorgfuncties.',80),
  ('asset_type','mixed_use','Mixed-use','Combinatie van meerdere gebruiksfuncties.',90),
  ('asset_type','land','Grond','Onbebouwde grond en ontwikkellocaties.',100),
  ('asset_type','brownfield','Brownfield','Bestaand terrein met herontwikkelingsopgave.',110),
  ('asset_type','other','Overig','Niet onder een andere standaardcategorie.',999),

  ('strategy','hold','Aanhouden','Object of onderdeel langdurig behouden.',10),
  ('strategy','rent','Verhuren','Exploitatie door verhuur.',20),
  ('strategy','renovate','Renoveren','Technisch of kwalitatief verbeteren.',30),
  ('strategy','split','Splitsen','Juridisch of bouwkundig splitsen.',40),
  ('strategy','room_rental','Verkameren','Kamergewijze verhuur realiseren.',50),
  ('strategy','transform','Transformeren','Gebruiksfunctie wijzigen.',60),
  ('strategy','expand','Uitbreiden','Extra vloeroppervlak of volume toevoegen.',70),
  ('strategy','demolish_newbuild','Sloop-nieuwbouw','Bestaande opstallen slopen en nieuw bouwen.',80),
  ('strategy','site_development','Gebiedsontwikkeling','Meerdere gebouwen of gronden integraal ontwikkelen.',90),
  ('strategy','sell','Verkopen','Geheel of onderdelen verkopen.',100),
  ('strategy','sale_and_leaseback','Sale-and-leaseback','Verkopen en terughuren.',110),
  ('strategy','undecided','Later beslissen','Strategie is nog niet gekozen.',999),

  ('project_phase','quickscan','Quickscan','Eerste indicatieve beoordeling.',10),
  ('project_phase','acquisition','Acquisitie / bieding','Verwerving en biedingsfase.',20),
  ('project_phase','feasibility','Haalbaarheid','Verdiepte haalbaarheidsfase.',30),
  ('project_phase','design','Ontwerp','Schets-, voorlopig of definitief ontwerp.',40),
  ('project_phase','permit','Vergunning','Planologische en vergunningfase.',50),
  ('project_phase','execution','Uitvoering','Bouw- en uitvoeringsfase.',60),
  ('project_phase','completion','Oplevering','Oplevering en ingebruikname.',70),
  ('project_phase','realized','Gerealiseerd','Werkelijk gerealiseerd project of resultaat.',80),

  ('risk_class','low','Laag risico','Relatief voorspelbare opgave.',10),
  ('risk_class','base','Basis','Normaal verwacht risicoprofiel.',20),
  ('risk_class','cautious','Voorzichtig','Extra marge voor onzekerheid.',30),
  ('risk_class','high','Hoog risico','Complexe of sterk onzekere opgave.',40),

  ('quality_level','basic','Basis','Functionele basiskwaliteit.',10),
  ('quality_level','average','Gemiddeld','Gangbare marktkwaliteit.',20),
  ('quality_level','high_end','Hoogwaardig','Bovengemiddelde afwerking en installaties.',30),
  ('quality_level','luxury','Luxe','Luxe segment en hoogwaardige detaillering.',40),

  ('complexity','low','Laag','Eenvoudige, overzichtelijke ingreep.',10),
  ('complexity','medium','Gemiddeld','Reguliere technische en organisatorische complexiteit.',20),
  ('complexity','high','Hoog','Veel afhankelijkheden, risico’s of specialistische ingrepen.',30),

  ('location_type','city_centre','Centrum','Binnenstad of primair centrumgebied.',10),
  ('location_type','urban_neighbourhood','Stadswijk','Stedelijke woon- of werkbuurt.',20),
  ('location_type','suburban','Stadsrand / suburbaan','Randstedelijk of suburbaan gebied.',30),
  ('location_type','station_area','Stationsgebied','Gebied rond OV-knooppunt of station.',40),
  ('location_type','business_park','Bedrijventerrein','Regulier bedrijventerrein.',50),
  ('location_type','industrial_area','Industriegebied','Zwaarder industrieel gebied.',60),
  ('location_type','highway_location','Snelweglocatie','Directe ligging aan hoofdweg of snelweg.',70),
  ('location_type','rural','Landelijk','Dorp, buitengebied of landelijke locatie.',80),
  ('location_type','mixed','Gemengd gebied','Gemengde stedelijke of functionele omgeving.',90),

  ('unit','percent','Percentage (%)','Percentage van een gekozen grondslag.',10),
  ('unit','eur','Bedrag (€)','Totaal bedrag in euro.',20),
  ('unit','eur_m2_bvo','€ per m² BVO','Euro per vierkante meter bruto vloeroppervlak.',30),
  ('unit','eur_m2_gbo','€ per m² GBO','Euro per vierkante meter gebruiksoppervlak.',40),
  ('unit','eur_m2_vvo','€ per m² VVO','Euro per vierkante meter verhuurbaar vloeroppervlak.',50),
  ('unit','eur_unit','€ per eenheid','Euro per woning, kamer, parkeerplaats of andere eenheid.',60),
  ('unit','eur_month','€ per maand','Maandbedrag in euro.',70),
  ('unit','eur_year','€ per jaar','Jaarbedrag in euro.',80),
  ('unit','months','Maanden','Aantal maanden.',90),
  ('unit','years','Jaren','Aantal jaren.',100),
  ('unit','index','Index','Indexgetal zonder valuta.',110),

  ('vat_treatment','ex_vat','Exclusief btw','Waarde is exclusief btw.',10),
  ('vat_treatment','incl_vat','Inclusief btw','Waarde is inclusief btw.',20),
  ('vat_treatment','no_vat','Geen btw','Btw is niet van toepassing.',30),
  ('vat_treatment','exempt','Vrijgesteld','Prestatie of transactie is vrijgesteld van btw.',40),
  ('vat_treatment','partially_deductible','Deels aftrekbaar','Btw is slechts gedeeltelijk aftrekbaar.',50),

  ('market_condition','weak','Zwakke markt','Lagere vraag of ruim aanbod.',10),
  ('market_condition','normal','Normale markt','Reguliere marktomstandigheden.',20),
  ('market_condition','strong','Sterke markt','Hoge vraag of beperkt aanbod.',30),

  ('scenario_profile','conservative','Conservatief','Voorzichtige aannames en extra buffers.',10),
  ('scenario_profile','base','Basis','Meest waarschijnlijke uitgangspunten.',20),
  ('scenario_profile','optimistic','Optimistisch','Gunstige maar onderbouwde aannames.',30)
on conflict (dimension_code, option_code) do update
set label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    updated_at = now();

alter table public.vastgoedrekenen_kengetallen
  add column if not exists asset_type_codes text[] null,
  add column if not exists strategy_codes text[] null,
  add column if not exists project_phase_codes text[] null,
  add column if not exists risk_class_codes text[] null,
  add column if not exists quality_level_codes text[] null,
  add column if not exists complexity_codes text[] null,
  add column if not exists location_type_codes text[] null,
  add column if not exists market_condition_codes text[] null,
  add column if not exists scenario_profile_codes text[] null,
  add column if not exists location_keys text[] null,
  add column if not exists unit_code text null,
  add column if not exists vat_treatment_code text null,
  add column if not exists classification_schema_version integer null;

alter table public.vastgoedrekenen_kengetallen
  drop constraint if exists vastgoedrekenen_kengetallen_classification_version_check,
  add constraint vastgoedrekenen_kengetallen_classification_version_check
    check (classification_schema_version is null or classification_schema_version = 1);

alter table public.scenario_kengetal_snapshots
  add column if not exists asset_type_codes text[] null,
  add column if not exists strategy_codes text[] null,
  add column if not exists project_phase_codes text[] null,
  add column if not exists risk_class_codes text[] null,
  add column if not exists quality_level_codes text[] null,
  add column if not exists complexity_codes text[] null,
  add column if not exists location_type_codes text[] null,
  add column if not exists market_condition_codes text[] null,
  add column if not exists scenario_profile_codes text[] null,
  add column if not exists location_keys text[] null,
  add column if not exists unit_code text null,
  add column if not exists vat_treatment_code text null,
  add column if not exists classification_schema_version integer null;

alter table public.scenario_kengetal_snapshots
  drop constraint if exists scenario_kengetal_snapshots_classification_version_check,
  add constraint scenario_kengetal_snapshots_classification_version_check
    check (classification_schema_version is null or classification_schema_version = 1);

create table if not exists public.acquisitie_gebiedsvoorkeuren (
  id uuid primary key default gen_random_uuid(),
  location_key text not null unique,
  location_level text not null,
  province_code text null,
  province_name text null,
  municipality_code text null,
  municipality_name text null,
  district_code text null,
  district_name text null,
  neighbourhood_code text null,
  neighbourhood_name text null,
  preference_status text not null,
  priority smallint not null default 3,
  asset_type_codes text[] not null default '{}',
  strategy_codes text[] not null default '{}',
  motivation text not null,
  notes text null,
  source_type text not null default 'manual',
  active boolean not null default true,
  version integer not null default 1,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint acquisitie_gebiedsvoorkeuren_level_check check (location_level in ('province','municipality','district','neighbourhood')),
  constraint acquisitie_gebiedsvoorkeuren_status_check check (preference_status in ('core','expand','watch','exclude')),
  constraint acquisitie_gebiedsvoorkeuren_priority_check check (priority between 1 and 5),
  constraint acquisitie_gebiedsvoorkeuren_source_check check (source_type in ('manual','signal_frequency','market_research','relationship_network','other')),
  constraint acquisitie_gebiedsvoorkeuren_version_check check (version > 0),
  constraint acquisitie_gebiedsvoorkeuren_name_check check (
    case location_level
      when 'province' then province_name is not null
      when 'municipality' then municipality_name is not null
      when 'district' then municipality_name is not null and district_name is not null
      when 'neighbourhood' then municipality_name is not null and neighbourhood_name is not null
      else false
    end
  )
);

alter table public.acquisitie_gebiedsvoorkeuren enable row level security;

drop policy if exists "Authenticated users can read area preferences" on public.acquisitie_gebiedsvoorkeuren;
create policy "Authenticated users can read area preferences"
  on public.acquisitie_gebiedsvoorkeuren for select to authenticated using (true);

drop policy if exists "Authenticated users can manage area preferences" on public.acquisitie_gebiedsvoorkeuren;
create policy "Authenticated users can manage area preferences"
  on public.acquisitie_gebiedsvoorkeuren for all to authenticated using (true) with check (true);

create or replace view public.view_acquisitie_gebiedsfrequentie
with (security_invoker = true) as
select
  'municipality'::text as location_level,
  coalesce(nullif(geo_gemeente_code, ''), 'municipality:' || lower(trim(geo_gemeente_naam))) as location_key,
  null::text as province_code,
  max(provincie) as province_name,
  max(geo_gemeente_code) as municipality_code,
  geo_gemeente_naam as municipality_name,
  null::text as district_code,
  null::text as district_name,
  null::text as neighbourhood_code,
  null::text as neighbourhood_name,
  count(*)::integer as signal_count,
  count(*) filter (where gearchiveerd_op is null)::integer as active_signal_count,
  max(coalesce(bron_datum, created_at::date)) as latest_signal_date
from public.off_market_signalen
where nullif(trim(geo_gemeente_naam), '') is not null
group by geo_gemeente_naam, coalesce(nullif(geo_gemeente_code, ''), 'municipality:' || lower(trim(geo_gemeente_naam)))

union all

select
  'district'::text,
  coalesce(nullif(geo_wijk_code, ''), 'district:' || lower(trim(coalesce(geo_gemeente_naam, ''))) || ':' || lower(trim(geo_wijk_naam))),
  null::text,
  max(provincie),
  max(geo_gemeente_code),
  geo_gemeente_naam,
  max(geo_wijk_code),
  geo_wijk_naam,
  null::text,
  null::text,
  count(*)::integer,
  count(*) filter (where gearchiveerd_op is null)::integer,
  max(coalesce(bron_datum, created_at::date))
from public.off_market_signalen
where nullif(trim(geo_wijk_naam), '') is not null
group by geo_gemeente_naam, geo_wijk_naam,
  coalesce(nullif(geo_wijk_code, ''), 'district:' || lower(trim(coalesce(geo_gemeente_naam, ''))) || ':' || lower(trim(geo_wijk_naam)))

union all

select
  'neighbourhood'::text,
  coalesce(nullif(geo_buurt_code, ''), 'neighbourhood:' || lower(trim(coalesce(geo_gemeente_naam, ''))) || ':' || lower(trim(geo_buurt_naam))),
  null::text,
  max(provincie),
  max(geo_gemeente_code),
  geo_gemeente_naam,
  max(geo_wijk_code),
  geo_wijk_naam,
  max(geo_buurt_code),
  geo_buurt_naam,
  count(*)::integer,
  count(*) filter (where gearchiveerd_op is null)::integer,
  max(coalesce(bron_datum, created_at::date))
from public.off_market_signalen
where nullif(trim(geo_buurt_naam), '') is not null
group by geo_gemeente_naam, geo_wijk_naam, geo_buurt_naam,
  coalesce(nullif(geo_buurt_code, ''), 'neighbourhood:' || lower(trim(coalesce(geo_gemeente_naam, ''))) || ':' || lower(trim(geo_buurt_naam)));

grant select on public.view_acquisitie_gebiedsfrequentie to authenticated;

comment on table public.vastgoedrekenen_taxonomie_opties is
  'Centraal versieerbaar register voor dropdowncodes in Vastgoedrekenen en acquisitie.';
comment on table public.acquisitie_gebiedsvoorkeuren is
  'Handmatig bevestigde voorkeurs-, uitbreidings-, volg- en uitsluitingsgebieden op officieel geografisch niveau.';
comment on view public.view_acquisitie_gebiedsfrequentie is
  'Read-only telling van bestaande Off-Market-signalen per gemeente, wijk en buurt; maakt geen voorkeuren automatisch aan.';
