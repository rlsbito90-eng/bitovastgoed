-- Objecten: current application columns, pre-import phase.
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS aanbiedingswijze public.aanbiedingswijze NOT NULL DEFAULT 'off_market',
  ADD COLUMN IF NOT EXISTS acquisitie_target_id uuid,
  ADD COLUMN IF NOT EXISTS propositie text,
  ADD COLUMN IF NOT EXISTS objectomschrijving text,
  ADD COLUMN IF NOT EXISTS locatie_omschrijving text,
  ADD COLUMN IF NOT EXISTS technische_staat_omschrijving text,
  ADD COLUMN IF NOT EXISTS proces_voorwaarden text,
  ADD COLUMN IF NOT EXISTS dataroom_url text,
  ADD COLUMN IF NOT EXISTS marktwaarde_indicatie bigint,
  ADD COLUMN IF NOT EXISTS marktwaarde_bron text,
  ADD COLUMN IF NOT EXISTS contact_naam text,
  ADD COLUMN IF NOT EXISTS contact_functie text,
  ADD COLUMN IF NOT EXISTS contact_telefoon text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS oppervlakten_per_verdieping jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS financiele_scenarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS documentatie_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS im_secties_zichtbaar jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS potentie_omschrijving text,
  ADD COLUMN IF NOT EXISTS potentie_strategie text,
  ADD COLUMN IF NOT EXISTS potentie_extra_m2 numeric,
  ADD COLUMN IF NOT EXISTS potentie_extra_units integer,
  ADD COLUMN IF NOT EXISTS potentie_onderbouwing_status text,
  ADD COLUMN IF NOT EXISTS potentie_afhankelijkheden text,
  ADD COLUMN IF NOT EXISTS potentie_bron text,
  ADD COLUMN IF NOT EXISTS markeer_als_referentie boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS archived_note text,
  ADD COLUMN IF NOT EXISTS crm_objectnummer text;

-- Decimal surface support required by the current UI.
ALTER TABLE public.objecten
  ALTER COLUMN oppervlakte TYPE numeric(14,2) USING oppervlakte::numeric,
  ALTER COLUMN oppervlakte_gbo TYPE numeric(14,2) USING oppervlakte_gbo::numeric,
  ALTER COLUMN oppervlakte_vvo TYPE numeric(14,2) USING oppervlakte_vvo::numeric,
  ALTER COLUMN oppervlakte_bvo TYPE numeric(14,2) USING oppervlakte_bvo::numeric,
  ALTER COLUMN perceel_oppervlakte TYPE numeric(14,2) USING perceel_oppervlakte::numeric;

CREATE INDEX IF NOT EXISTS idx_objecten_is_archived ON public.objecten (is_archived);

-- Prepare readable CRM object numbering, but deliberately do NOT set a column
-- default, backfill, NOT NULL, uniqueness or immutability until source data is imported.
CREATE SEQUENCE IF NOT EXISTS public.crm_objectnummer_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.next_crm_objectnummer()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'OBJ-' || lpad(nextval('public.crm_objectnummer_seq')::text, 6, '0');
$$;
REVOKE ALL ON FUNCTION public.next_crm_objectnummer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_crm_objectnummer() TO authenticated, service_role;
ALTER SEQUENCE public.crm_objectnummer_seq OWNED BY public.objecten.crm_objectnummer;