-- BUILD 1G.3 — accountgebonden opgeslagen zoekopdrachten voor Pandenverkenner.
-- Applicatiedata in eigen CRM-Supabase; geen BAG-brondata.

CREATE TABLE IF NOT EXISTS public.bag_zoekprofielen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  naam text NOT NULL CHECK (char_length(btrim(naam)) BETWEEN 1 AND 120),
  scope_code text NOT NULL CHECK (scope_code ~ '^[0-9]{4}$'),
  server_filters jsonb NOT NULL,
  filters jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bag_zoekprofielen_user_scope_updated_idx
  ON public.bag_zoekprofielen (user_id, scope_code, updated_at DESC);

ALTER TABLE public.bag_zoekprofielen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bag_zoekprofielen FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bag_zoekprofielen_select_eigen" ON public.bag_zoekprofielen;
CREATE POLICY "bag_zoekprofielen_select_eigen"
  ON public.bag_zoekprofielen FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bag_zoekprofielen_insert_eigen" ON public.bag_zoekprofielen;
CREATE POLICY "bag_zoekprofielen_insert_eigen"
  ON public.bag_zoekprofielen FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bag_zoekprofielen_update_eigen" ON public.bag_zoekprofielen;
CREATE POLICY "bag_zoekprofielen_update_eigen"
  ON public.bag_zoekprofielen FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bag_zoekprofielen_delete_eigen" ON public.bag_zoekprofielen;
CREATE POLICY "bag_zoekprofielen_delete_eigen"
  ON public.bag_zoekprofielen FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.bag_zoekprofielen FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bag_zoekprofielen TO authenticated;

CREATE OR REPLACE FUNCTION public.set_bag_zoekprofiel_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bag_zoekprofielen_set_updated_at ON public.bag_zoekprofielen;
CREATE TRIGGER bag_zoekprofielen_set_updated_at
BEFORE UPDATE ON public.bag_zoekprofielen
FOR EACH ROW EXECUTE FUNCTION public.set_bag_zoekprofiel_updated_at();