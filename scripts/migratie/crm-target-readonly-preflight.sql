-- Bito CRM target preflight — uitsluitend read-only.
-- Bedoeld voor het eigen CRM-doelproject vyjocdlwfxrblusfngfq.
-- Voert geen DDL, DML, grants, function-calls of configuratiewijzigingen uit.

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

-- 1. Sessiebasis
SELECT
  current_database() AS database_name,
  current_user AS database_user,
  now() AS gecontroleerd_op;

-- 2. Publieke tabellen en RLS-status
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  c.reltuples::bigint AS estimated_rows
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
ORDER BY c.relname;

-- 3. Kritieke CRM-objecten: bestaan ze al op het doelproject?
SELECT *
FROM (VALUES
  ('profiles', to_regclass('public.profiles') IS NOT NULL),
  ('user_roles', to_regclass('public.user_roles') IS NOT NULL),
  ('relaties', to_regclass('public.relaties') IS NOT NULL),
  ('objecten', to_regclass('public.objecten') IS NOT NULL),
  ('deals', to_regclass('public.deals') IS NOT NULL),
  ('taken', to_regclass('public.taken') IS NOT NULL),
  ('off_market_signalen', to_regclass('public.off_market_signalen') IS NOT NULL),
  ('off_market_bronnen', to_regclass('public.off_market_bronnen') IS NOT NULL),
  ('off_market_signalen_ruw', to_regclass('public.off_market_signalen_ruw') IS NOT NULL),
  ('off_market_ai_runs', to_regclass('public.off_market_ai_runs') IS NOT NULL),
  ('off_market_acquisitie_selectie', to_regclass('public.off_market_acquisitie_selectie') IS NOT NULL),
  ('off_market_acquisitie_dossiers', to_regclass('public.off_market_acquisitie_dossiers') IS NOT NULL),
  ('off_market_brieven', to_regclass('public.off_market_brieven') IS NOT NULL),
  ('off_market_brief_versies', to_regclass('public.off_market_brief_versies') IS NOT NULL),
  ('off_market_productie_events', to_regclass('public.off_market_productie_events') IS NOT NULL),
  ('kadaster_data_records', to_regclass('public.kadaster_data_records') IS NOT NULL),
  ('kadaster_documenten', to_regclass('public.kadaster_documenten') IS NOT NULL)
) AS verwacht(object_name, exists_on_target)
ORDER BY object_name;

-- 4. Publieke functies/RPC's: metadata, geen uitvoering.
SELECT
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_catalog.pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS security_definer
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, identity_arguments;

-- 5. Kritieke Productiekern-RPC's: uitsluitend aanwezigheid controleren.
WITH vereiste_rpc(naam) AS (
  VALUES
    ('off_market_verwerking_starten'),
    ('off_market_brief_reserveren'),
    ('off_market_briefversie_aanmaken'),
    ('off_market_printbatch_aanmaken'),
    ('off_market_briefversie_aan_batch_toevoegen')
)
SELECT
  v.naam AS rpc_name,
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = v.naam
  ) AS exists_on_target
FROM vereiste_rpc v
ORDER BY v.naam;

-- 6. RLS-policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Niet-interne triggers op publieke tabellen
SELECT
  event_object_schema AS schema_name,
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation;

-- 8. Auth-basis. Alleen telling; geen persoonsgegevens selecteren.
SELECT count(*)::bigint AS auth_user_count
FROM auth.users;

-- 9. Storage-basis. Alleen buckets + tellingen; geen objectinhoud.
SELECT
  b.id AS bucket_id,
  b.name AS bucket_name,
  b.public,
  count(o.id)::bigint AS object_count
FROM storage.buckets b
LEFT JOIN storage.objects o ON o.bucket_id = b.id
GROUP BY b.id, b.name, b.public
ORDER BY b.name;

-- 10. Geïnstalleerde extensions voor schema-compatibiliteit.
SELECT
  e.extname AS extension_name,
  e.extversion AS extension_version,
  n.nspname AS extension_schema
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

ROLLBACK;
