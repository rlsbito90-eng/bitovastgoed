CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

CREATE TABLE IF NOT EXISTS public.crm_objectregistraties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objectnummer bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  bag_pand_id text,
  bag_verblijfsobject_id text,
  adres text NOT NULL,
  postcode text,
  plaats text,
  adres_sleutel text NOT NULL,
  objectniveau text NOT NULL DEFAULT 'pand' CHECK (objectniveau IN ('pand','verblijfsobject','adres','complex')),
  status text NOT NULL DEFAULT 'actief' CHECK (status IN ('actief','samengevoegd','vervallen')),
  samengevoegd_in_id uuid REFERENCES public.crm_objectregistraties(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid NOT NULL DEFAULT auth.uid()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_objectregistraties_bag_vbo_uniek
  ON public.crm_objectregistraties (bag_verblijfsobject_id)
  WHERE bag_verblijfsobject_id IS NOT NULL AND status = 'actief';
CREATE UNIQUE INDEX IF NOT EXISTS crm_objectregistraties_bag_pand_adres_uniek
  ON public.crm_objectregistraties (bag_pand_id, adres_sleutel)
  WHERE bag_pand_id IS NOT NULL AND status = 'actief';
CREATE INDEX IF NOT EXISTS crm_objectregistraties_adres_sleutel_idx
  ON public.crm_objectregistraties (adres_sleutel);
CREATE INDEX IF NOT EXISTS crm_objectregistraties_samengevoegd_in_idx
  ON public.crm_objectregistraties (samengevoegd_in_id)
  WHERE samengevoegd_in_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_objectbronkoppelingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objectregistratie_id uuid NOT NULL REFERENCES public.crm_objectregistraties(id) ON DELETE CASCADE,
  bron_type text NOT NULL CHECK (bron_type IN ('vastgoedkans','object','off_market_signaal','deal','acquisitie_target')),
  bron_id uuid NOT NULL,
  koppelwijze text NOT NULL CHECK (koppelwijze IN ('bag_verblijfsobject','bag_pand','adres','handmatig')),
  actief boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE (bron_type, bron_id)
);
CREATE INDEX IF NOT EXISTS crm_objectbronkoppelingen_object_idx
  ON public.crm_objectbronkoppelingen (objectregistratie_id, actief);

ALTER TABLE public.crm_objectregistraties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_objectbronkoppelingen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_objectregistraties_lezen" ON public.crm_objectregistraties;
CREATE POLICY "crm_objectregistraties_lezen"
  ON public.crm_objectregistraties FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_objectregistraties_toevoegen" ON public.crm_objectregistraties;
CREATE POLICY "crm_objectregistraties_toevoegen"
  ON public.crm_objectregistraties FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) OR (SELECT public.is_app_admin()));
DROP POLICY IF EXISTS "crm_objectregistraties_bijwerken" ON public.crm_objectregistraties;
CREATE POLICY "crm_objectregistraties_bijwerken"
  ON public.crm_objectregistraties FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (SELECT public.is_app_admin()))
  WITH CHECK (created_by = (SELECT auth.uid()) OR (SELECT public.is_app_admin()));
DROP POLICY IF EXISTS "crm_objectregistraties_beheerder_verwijderen" ON public.crm_objectregistraties;
CREATE POLICY "crm_objectregistraties_beheerder_verwijderen"
  ON public.crm_objectregistraties FOR DELETE TO authenticated
  USING ((SELECT public.is_app_admin()));

DROP POLICY IF EXISTS "crm_objectbronkoppelingen_lezen" ON public.crm_objectbronkoppelingen;
CREATE POLICY "crm_objectbronkoppelingen_lezen"
  ON public.crm_objectbronkoppelingen FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crm_objectbronkoppelingen_toevoegen" ON public.crm_objectbronkoppelingen;
CREATE POLICY "crm_objectbronkoppelingen_toevoegen"
  ON public.crm_objectbronkoppelingen FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) OR (SELECT public.is_app_admin()));
DROP POLICY IF EXISTS "crm_objectbronkoppelingen_bijwerken" ON public.crm_objectbronkoppelingen;
CREATE POLICY "crm_objectbronkoppelingen_bijwerken"
  ON public.crm_objectbronkoppelingen FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR (SELECT public.is_app_admin()))
  WITH CHECK (created_by = (SELECT auth.uid()) OR (SELECT public.is_app_admin()));
DROP POLICY IF EXISTS "crm_objectbronkoppelingen_beheerder_verwijderen" ON public.crm_objectbronkoppelingen;
CREATE POLICY "crm_objectbronkoppelingen_beheerder_verwijderen"
  ON public.crm_objectbronkoppelingen FOR DELETE TO authenticated
  USING ((SELECT public.is_app_admin()));