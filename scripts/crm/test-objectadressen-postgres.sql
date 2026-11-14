-- GEÏSOLEERDE CI-TEST. Draait uitsluitend in de tijdelijke PostgreSQL-service.
-- Synthetic data only. Geen productie- of Supabase-credentials.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE FUNCTION public.is_intern_gebruiker(uid uuid) RETURNS boolean LANGUAGE sql STABLE
  AS $$ SELECT uid = '11111111-1111-1111-1111-111111111111'::uuid $$;

-- Statische stub voor bestaande crm.objecten-FK.
-- Test alleen de nieuwe adres/onderdeel-schema's, niet de volledige CRM-migratie.
CREATE TABLE public.objecten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objectnaam text NOT NULL,
  type_vastgoed text NOT NULL
);

-- Het ontwerp-SQL wordt na deze setup als aparte stap toegepast.
