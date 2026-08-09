-- CRM-MIG-2A read-only schema probe
-- Doel: uitsluitend metadata-inventarisatie van het expliciet bevestigde CRM-doelproject.
-- Geen DDL, geen DML, geen function calls met side effects.

-- 1. Public tabellen en views
select
  table_type,
  table_name
from information_schema.tables
where table_schema = 'public'
order by table_type, table_name;

-- 2. Public kolommen
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3. Public enumtypen
select
  t.typname as enum_name,
  e.enumsortorder,
  e.enumlabel
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
order by t.typname, e.enumsortorder;

-- 4. Public functies/RPC's
select distinct
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, identity_arguments;

-- 5. RLS-status
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 6. Policies
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 7. Constraints
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 8. Indexes
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 9. Triggers
select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name, event_manipulation;

-- 10. Supabase-migratiehistorie
select
  version,
  name
from supabase_migrations.schema_migrations
order by version;

-- 11. Auth/Storage tellingen; metadata/read-only
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from storage.buckets) as storage_buckets,
  (select count(*) from storage.objects) as storage_objects;
