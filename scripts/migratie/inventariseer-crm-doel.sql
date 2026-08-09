-- CRM doelinventarisatie — READ ONLY
-- Bedoeld voor het eigen CRM-doelproject vyjocdlwfxrblusfngfq.
-- Deze query leest uitsluitend catalogus-/metadata en globale Auth/Storage-tellingen.

with public_tables as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    coalesce(c.reltuples::bigint, 0) as estimated_rows,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', a.attname,
          'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull,
          'default', pg_get_expr(ad.adbin, ad.adrelid)
        ) order by a.attnum
      )
      from pg_attribute a
      left join pg_attrdef ad
        on ad.adrelid = a.attrelid and ad.adnum = a.attnum
      where a.attrelid = c.oid
        and a.attnum > 0
        and not a.attisdropped
    ), '[]'::jsonb) as columns
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
),
public_views as (
  select
    table_name as view_name,
    view_definition
  from information_schema.views
  where table_schema = 'public'
),
public_functions as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
public_triggers as (
  select
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
  from information_schema.triggers
  where trigger_schema = 'public'
),
public_policies as (
  select
    tablename as table_name,
    policyname as policy_name,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname = 'public'
),
extensions as (
  select extname as name, extversion as version
  from pg_extension
),
migrations as (
  select version::text as version
  from supabase_migrations.schema_migrations
  order by version
)
select jsonb_pretty(jsonb_build_object(
  'schema_version', 1,
  'target_expected_project_ref', 'vyjocdlwfxrblusfngfq',
  'generated_from', 'database_metadata',
  'counts', jsonb_build_object(
    'public_tables', (select count(*) from public_tables),
    'public_views', (select count(*) from public_views),
    'public_functions', (select count(*) from public_functions),
    'public_triggers', (select count(*) from public_triggers),
    'public_policies', (select count(*) from public_policies),
    'auth_users', (select count(*) from auth.users),
    'storage_buckets', (select count(*) from storage.buckets),
    'storage_objects', (select count(*) from storage.objects),
    'registered_migrations', (select count(*) from migrations)
  ),
  'public_tables', coalesce((
    select jsonb_agg(to_jsonb(t) order by t.table_name) from public_tables t
  ), '[]'::jsonb),
  'public_views', coalesce((
    select jsonb_agg(to_jsonb(v) order by v.view_name) from public_views v
  ), '[]'::jsonb),
  'public_functions', coalesce((
    select jsonb_agg(to_jsonb(f) order by f.function_name, f.identity_arguments) from public_functions f
  ), '[]'::jsonb),
  'public_triggers', coalesce((
    select jsonb_agg(to_jsonb(t) order by t.table_name, t.trigger_name, t.event_manipulation) from public_triggers t
  ), '[]'::jsonb),
  'public_policies', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.table_name, p.policy_name) from public_policies p
  ), '[]'::jsonb),
  'extensions', coalesce((
    select jsonb_agg(to_jsonb(e) order by e.name) from extensions e
  ), '[]'::jsonb),
  'registered_migrations', coalesce((
    select jsonb_agg(m.version order by m.version) from migrations m
  ), '[]'::jsonb)
)) as crm_target_inventory;
