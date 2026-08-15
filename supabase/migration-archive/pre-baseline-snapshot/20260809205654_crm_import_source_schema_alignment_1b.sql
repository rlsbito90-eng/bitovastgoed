drop view if exists public.object_huur_metrics;

alter table public.biedingen
  add column if not exists richting public.bieding_richting not null default 'van_koper';

alter table public.calculation_components
  alter column surface_gbo type numeric(14,2) using surface_gbo::numeric,
  alter column surface_vvo type numeric(14,2) using surface_vvo::numeric,
  alter column surface_bvo type numeric(14,2) using surface_bvo::numeric;

alter table public.sell_off_units
  alter column surface_gbo type numeric(14,2) using surface_gbo::numeric,
  alter column surface_vvo type numeric(14,2) using surface_vvo::numeric,
  alter column surface_bvo type numeric(14,2) using surface_bvo::numeric;

alter table public.residential_wws_units
  alter column living_area_m2 type numeric(14,2) using living_area_m2::numeric,
  alter column other_indoor_space_m2 drop default,
  alter column other_indoor_space_m2 type numeric(14,2) using other_indoor_space_m2::numeric,
  alter column other_indoor_space_m2 set default 0,
  alter column outdoor_space_m2 drop default,
  alter column outdoor_space_m2 type numeric(14,2) using outdoor_space_m2::numeric,
  alter column outdoor_space_m2 set default 0;

alter table public.object_huurders
  alter column oppervlakte_m2 type numeric(14,2) using oppervlakte_m2::numeric;

alter table public.object_fotos
  add column if not exists updated_at timestamptz not null default now();

create view public.object_huur_metrics as
select o.id as object_id,
  coalesce(count(h.id), 0::bigint)::integer as aantal_huurders,
  coalesce(sum(h.jaarhuur), 0::numeric)::bigint as totale_jaarhuur,
  coalesce(sum(h.oppervlakte_m2), 0::numeric)::numeric(14,2) as verhuurde_m2,
  case when sum(h.jaarhuur) > 0::numeric then round(sum(extract(epoch from h.einddatum::timestamp without time zone::timestamp with time zone - now()) / 31557600.0 * h.jaarhuur::numeric) / nullif(sum(h.jaarhuur), 0::numeric), 2) else null::numeric end as walt_jaren,
  case when sum(h.jaarhuur) > 0::numeric then round(sum(extract(epoch from h.einddatum::timestamp without time zone::timestamp with time zone - now()) / 31557600.0 * h.jaarhuur::numeric) / nullif(sum(h.jaarhuur), 0::numeric), 2) else null::numeric end as walb_jaren
from public.objecten o left join public.object_huurders h on h.object_id=o.id group by o.id;

grant select on public.object_huur_metrics to authenticated;
grant all on public.object_huur_metrics to service_role;