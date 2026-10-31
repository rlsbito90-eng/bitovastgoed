-- Database migration applied to Bito CRM production in Supabase
-- Server migration version: 20261031201632, name: add_commercial_roles_to_relations_a11
-- Additive: no backfill or user-data modification.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '25s';
DO $preflight$
DECLARE n integer;
BEGIN
 SELECT COUNT(*) INTO n FROM information_schema.columns
 WHERE table_schema='public' AND table_name='relaties' AND column_name='commercial_roles';
 IF n <> 0 THEN RAISE EXCEPTION 'commercial_roles exists; stop and reconcile migration'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace p ON p.oid=c.relnamespace
  WHERE p.nspname='public' AND c.relname='relaties' AND c.relrowsecurity
 ) THEN RAISE EXCEPTION 'RLS must already be enabled on public.relaties';
 END IF;
END $preflight$;
ALTER TABLE public.relaties ADD COLUMN commercial_roles text[] NULL;
ALTER TABLE public.relaties
 ADD CONSTRAINT relaties_commercial_roles_allowed
 CHECK (
  commercial_roles IS NULL OR (
   commercial_roles <@ ARRAY['koper','verkoper','makelaar','bemiddelaar','ontwikkelaar','adviseur','beheerder','financier','overig']::text[]
   AND array_position(commercial_roles, NULL) IS NULL
  )
 );
COMMIT;
