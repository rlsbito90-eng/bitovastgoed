-- CRM-MIG-2C-1 — read-only delta voor property/deal-classificatie
-- Uitsluitend uitvoeren op expliciet bevestigd doelproject vyjocdlwfxrblusfngfq.
-- Geen DDL, DML of function calls met side effects.

-- 1. Bestaan van de vier nieuwe classificatietabellen
select
  x.table_name,
  to_regclass('public.' || x.table_name) is not null as aanwezig
from (values
  ('property_types'),
  ('property_subtypes'),
  ('deal_types'),
  ('property_type_aliases')
) as x(table_name)
order by x.table_name;

-- 2. Benodigde koppelingkolommen op bestaande tabellen
select
  expected.table_name,
  expected.column_name,
  c.column_name is not null as aanwezig,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from (values
  ('objecten','property_type_id'),
  ('objecten','property_subtype_ids'),
  ('objecten','deal_type_ids'),
  ('zoekprofielen','property_type_ids'),
  ('zoekprofielen','property_subtype_ids_v2'),
  ('zoekprofielen','deal_type_ids'),
  ('relaties','property_type_ids'),
  ('relaties','property_subtype_ids'),
  ('relaties','deal_type_ids')
) as expected(table_name,column_name)
left join information_schema.columns c
  on c.table_schema='public'
 and c.table_name=expected.table_name
 and c.column_name=expected.column_name
order by expected.table_name, expected.column_name;

-- 3. Benodigde indexes
select
  expected.index_name,
  i.indexname is not null as aanwezig,
  i.indexdef
from (values
  ('idx_property_subtypes_type'),
  ('idx_property_aliases_alias'),
  ('idx_objecten_property_type'),
  ('idx_objecten_property_subtypes'),
  ('idx_objecten_deal_types'),
  ('idx_zoekprofielen_property_types'),
  ('idx_zoekprofielen_property_subtypes_v2'),
  ('idx_zoekprofielen_deal_types'),
  ('idx_relaties_property_types'),
  ('idx_relaties_property_subtypes')
) as expected(index_name)
left join pg_indexes i
  on i.schemaname='public' and i.indexname=expected.index_name
order by expected.index_name;

-- 4. RLS-policydependencies die de historische bronmigratie gebruikt
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('has_role','is_intern_gebruiker')
order by p.proname;

-- 5. app_role labels die door adminpolicies worden gebruikt
select e.enumlabel
from pg_type t
join pg_namespace n on n.oid=t.typnamespace
join pg_enum e on e.enumtypid=t.oid
where n.nspname='public' and t.typname='app_role'
order by e.enumsortorder;
