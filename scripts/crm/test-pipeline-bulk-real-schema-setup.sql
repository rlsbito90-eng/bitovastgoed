-- Afzonderlijke WEGWERP-database, leeg geinitialiseerd in GitHub Actions.
-- Geen persoonsgegevens, productie-DATABASE_URL, service_role of echte CRM-data.
-- Hierna voert CI de ECHTE bestaande CRM-migraties uit, geen nagemaakt schema.
DO $roles$
BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon')
    THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated')
    THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $roles$;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

CREATE TYPE public.app_role AS ENUM ('admin','medewerker');
CREATE FUNCTION public.is_intern_gebruiker(uid uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT uid='11111111-1111-1111-1111-111111111111'::uuid
$$;
CREATE FUNCTION public.has_role(uid uuid,role public.app_role) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT uid='11111111-1111-1111-1111-111111111111'::uuid AND role='admin'
$$;

-- EXACTE productietrigger: deze zet expliciete clock_timestamp() terug naar now().
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.updated_at=now();
  RETURN NEW;
END
$$;

CREATE TABLE public.objecten(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 objectnaam text NOT NULL,
 type_vastgoed text NOT NULL,
 archived_reason text
);
CREATE TABLE public.deals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 archived_reason text,
 afwijzingsreden text
);

-- De bestaande pipeline -> taken-trigger verwacht de volgende kolommen.
-- Alleen de centrale taak-tabel wordt minimaal nagebootst.
CREATE TABLE public.taken(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id uuid,
 titel text NOT NULL,
 type_taak text,
 deadline date,
 deadline_tijd time,
 prioriteit text,
 status text NOT NULL,
 relatie_id uuid,
 object_id uuid,
 deal_id uuid,
 source_kind text,
 source_id uuid,
 source_slot text,
 soft_deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX test_taak_active_source ON public.taken(source_kind,source_id,source_slot)
  WHERE soft_deleted_at IS NULL AND status IN ('open','in_uitvoering','wacht_op_reactie');
