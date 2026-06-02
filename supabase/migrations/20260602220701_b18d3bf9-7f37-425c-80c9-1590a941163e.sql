
-- =============================================================
-- Off-Market Radar — Fase 1 (datalaag)
-- =============================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.off_market_assettype AS ENUM (
    'kantoor','winkelpand','woon_winkelpand','bedrijfscomplex','light_industrial',
    'logistiek','zorgvastgoed','transformatieobject','ontwikkellocatie',
    'vastgoedportefeuille','overig'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_bron_type AS ENUM (
    'handmatig','bekendmaking','vergunning','bag','kvk','nieuws','rss','csv','overig'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_signaaltype AS ENUM (
    'vergunning_bekendmaking','functiewijziging','transformatiepotentie','leegstand',
    'bedrijfsbeeindiging','lang_bezit','onderbenutte_locatie','vastgoednieuws',
    'netwerk','handmatige_research','overig'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_prioriteit AS ENUM ('laag','midden','hoog','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_market_status AS ENUM (
    'nieuw_signaal','te_onderzoeken','eigenaar_achterhalen','benaderen',
    'in_gesprek','object_ontvangen','dealtraject','niet_interessant','archief'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- off_market_bronnen ----------
CREATE TABLE public.off_market_bronnen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  type public.off_market_bron_type NOT NULL DEFAULT 'handmatig',
  endpoint_url text,
  auth_secret_naam text,
  actief boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  laatste_run_op timestamptz,
  laatste_run_status text,
  laatste_fout text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.off_market_bronnen TO authenticated;
GRANT ALL ON public.off_market_bronnen TO service_role;

ALTER TABLE public.off_market_bronnen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest off_market_bronnen"
  ON public.off_market_bronnen FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt off_market_bronnen toe"
  ON public.off_market_bronnen FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt off_market_bronnen"
  ON public.off_market_bronnen FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert off_market_bronnen"
  ON public.off_market_bronnen FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_off_market_bronnen_updated
  BEFORE UPDATE ON public.off_market_bronnen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- off_market_signalen ----------
CREATE TABLE public.off_market_signalen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  adres text,
  postcode text,
  plaats text,
  provincie text,
  regio text,
  lat numeric(10,7),
  lng numeric(10,7),
  assettype public.off_market_assettype NOT NULL DEFAULT 'overig',
  bron_id uuid REFERENCES public.off_market_bronnen(id) ON DELETE SET NULL,
  bron_type public.off_market_bron_type NOT NULL DEFAULT 'handmatig',
  type_signaal public.off_market_signaaltype NOT NULL DEFAULT 'handmatige_research',
  omschrijving text,
  eigenaar_bekend boolean NOT NULL DEFAULT false,
  eigenaar_relatie_id uuid REFERENCES public.relaties(id) ON DELETE SET NULL,
  potentiele_strategie text,
  indicatieve_waarde numeric(14,2),
  mogelijke_fee numeric(14,2),
  prioriteit public.off_market_prioriteit NOT NULL DEFAULT 'midden',
  status public.off_market_status NOT NULL DEFAULT 'nieuw_signaal',
  volgende_actie_datum date,
  volgende_actie_omschrijving text,
  notities text,
  bron_url text,
  bron_referentie text,
  bron_datum date,
  gekoppeld_object_id uuid REFERENCES public.objecten(id) ON DELETE SET NULL,
  gekoppelde_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  gearchiveerd_op timestamptz,
  archief_reden text,
  -- AI-velden (skeleton, leeg in MVP)
  ai_score integer CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100)),
  ai_samenvatting text,
  ai_aanbevolen_actie text,
  ai_classificatie_assettype public.off_market_assettype,
  ai_strategie_suggestie text,
  ai_verkoopkans numeric(4,3) CHECK (ai_verkoopkans IS NULL OR (ai_verkoopkans >= 0 AND ai_verkoopkans <= 1)),
  ai_dedupe_groep_id uuid,
  ai_laatst_verrijkt_op timestamptz,
  ai_model text,
  ai_prompt_versie text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- full-text search (titel + adres + plaats + omschrijving + notities)
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(titel,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(adres,'') || ' ' || coalesce(plaats,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(omschrijving,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(notities,'')), 'D')
  ) STORED
);

CREATE INDEX idx_off_market_signalen_status      ON public.off_market_signalen(status);
CREATE INDEX idx_off_market_signalen_prioriteit  ON public.off_market_signalen(prioriteit);
CREATE INDEX idx_off_market_signalen_assettype   ON public.off_market_signalen(assettype);
CREATE INDEX idx_off_market_signalen_provincie   ON public.off_market_signalen(provincie);
CREATE INDEX idx_off_market_signalen_vol_actie   ON public.off_market_signalen(volgende_actie_datum) WHERE volgende_actie_datum IS NOT NULL;
CREATE INDEX idx_off_market_signalen_ai_score    ON public.off_market_signalen(ai_score DESC NULLS LAST);
CREATE INDEX idx_off_market_signalen_eigenaar    ON public.off_market_signalen(eigenaar_relatie_id) WHERE eigenaar_relatie_id IS NOT NULL;
CREATE INDEX idx_off_market_signalen_object      ON public.off_market_signalen(gekoppeld_object_id) WHERE gekoppeld_object_id IS NOT NULL;
CREATE INDEX idx_off_market_signalen_deal        ON public.off_market_signalen(gekoppelde_deal_id) WHERE gekoppelde_deal_id IS NOT NULL;
CREATE INDEX idx_off_market_signalen_bron        ON public.off_market_signalen(bron_id) WHERE bron_id IS NOT NULL;
CREATE INDEX idx_off_market_signalen_created     ON public.off_market_signalen(created_at DESC);
CREATE INDEX idx_off_market_signalen_search      ON public.off_market_signalen USING GIN (search_tsv);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.off_market_signalen TO authenticated;
GRANT ALL ON public.off_market_signalen TO service_role;

ALTER TABLE public.off_market_signalen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest off_market_signalen"
  ON public.off_market_signalen FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt off_market_signalen toe"
  ON public.off_market_signalen FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt off_market_signalen"
  ON public.off_market_signalen FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert off_market_signalen"
  ON public.off_market_signalen FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_off_market_signalen_updated
  BEFORE UPDATE ON public.off_market_signalen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- off_market_signalen_ruw ----------
CREATE TABLE public.off_market_signalen_ruw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bron_id uuid NOT NULL REFERENCES public.off_market_bronnen(id) ON DELETE CASCADE,
  extern_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_hash text,
  binnengekomen_op timestamptz NOT NULL DEFAULT now(),
  verwerkt boolean NOT NULL DEFAULT false,
  signaal_id uuid REFERENCES public.off_market_signalen(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_off_market_ruw_bron_extern UNIQUE (bron_id, extern_id)
);

CREATE INDEX idx_off_market_ruw_verwerkt ON public.off_market_signalen_ruw(verwerkt, binnengekomen_op DESC);
CREATE INDEX idx_off_market_ruw_dedupe   ON public.off_market_signalen_ruw(dedupe_hash) WHERE dedupe_hash IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.off_market_signalen_ruw TO authenticated;
GRANT ALL ON public.off_market_signalen_ruw TO service_role;

ALTER TABLE public.off_market_signalen_ruw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest off_market_ruw"
  ON public.off_market_signalen_ruw FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt off_market_ruw toe"
  ON public.off_market_signalen_ruw FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt off_market_ruw"
  ON public.off_market_signalen_ruw FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert off_market_ruw"
  ON public.off_market_signalen_ruw FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_off_market_ruw_updated
  BEFORE UPDATE ON public.off_market_signalen_ruw
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- off_market_ai_runs ----------
CREATE TABLE public.off_market_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signaal_id uuid NOT NULL REFERENCES public.off_market_signalen(id) ON DELETE CASCADE,
  model text NOT NULL,
  prompt_versie text,
  input_hash text,
  output jsonb,
  kosten numeric(10,4),
  latentie_ms integer,
  run_op timestamptz NOT NULL DEFAULT now(),
  succes boolean NOT NULL DEFAULT true,
  fout text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_off_market_ai_runs_signaal ON public.off_market_ai_runs(signaal_id, run_op DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.off_market_ai_runs TO authenticated;
GRANT ALL ON public.off_market_ai_runs TO service_role;

ALTER TABLE public.off_market_ai_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest off_market_ai_runs"
  ON public.off_market_ai_runs FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt off_market_ai_runs toe"
  ON public.off_market_ai_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt off_market_ai_runs"
  ON public.off_market_ai_runs FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert off_market_ai_runs"
  ON public.off_market_ai_runs FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

-- ---------- Link-kolommen op bestaande tabellen ----------
ALTER TABLE public.contact_moments
  ADD COLUMN IF NOT EXISTS off_market_signaal_id uuid REFERENCES public.off_market_signalen(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contact_moments_off_market
  ON public.contact_moments(off_market_signaal_id) WHERE off_market_signaal_id IS NOT NULL;

ALTER TABLE public.taken
  ADD COLUMN IF NOT EXISTS off_market_signaal_id uuid REFERENCES public.off_market_signalen(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_taken_off_market
  ON public.taken(off_market_signaal_id) WHERE off_market_signaal_id IS NOT NULL;

-- ---------- KPI view ----------
CREATE OR REPLACE VIEW public.view_off_market_kpi
WITH (security_invoker = true)
AS
SELECT
  count(*) FILTER (WHERE created_at >= date_trunc('week', now()))                                            AS nieuwe_deze_week,
  count(*) FILTER (WHERE prioriteit IN ('hoog','urgent') AND status NOT IN ('archief','niet_interessant'))  AS hoge_prioriteit,
  count(*) FILTER (WHERE status = 'te_onderzoeken')                                                         AS te_onderzoeken,
  count(*) FILTER (WHERE status IN ('eigenaar_achterhalen','benaderen'))                                    AS eigenaren_te_benaderen,
  count(*) FILTER (WHERE status = 'in_gesprek')                                                             AS in_gesprek,
  count(*) FILTER (WHERE status = 'object_ontvangen')                                                       AS objecten_ontvangen,
  COALESCE(sum(mogelijke_fee) FILTER (
    WHERE status NOT IN ('archief','niet_interessant')
  ), 0)::numeric(14,2)                                                                                      AS fee_pipeline
FROM public.off_market_signalen;

GRANT SELECT ON public.view_off_market_kpi TO authenticated;
GRANT SELECT ON public.view_off_market_kpi TO service_role;

-- ---------- Promote-functie (idempotent) ----------
CREATE OR REPLACE FUNCTION public.off_market_promote_to_object(_signaal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.off_market_signalen%ROWTYPE;
  v_object_id uuid;
  v_asset public.asset_class;
BEGIN
  -- Toegang: alleen interne gebruikers
  IF NOT public.is_intern_gebruiker(auth.uid()) THEN
    RAISE EXCEPTION 'Geen toegang';
  END IF;

  SELECT * INTO s FROM public.off_market_signalen WHERE id = _signaal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signaal niet gevonden';
  END IF;

  -- Idempotent: als al gekoppeld, geef bestaand object terug
  IF s.gekoppeld_object_id IS NOT NULL THEN
    RETURN s.gekoppeld_object_id;
  END IF;

  -- Map off_market_assettype naar bestaande asset_class enum (best effort)
  v_asset := CASE s.assettype
    WHEN 'kantoor'              THEN 'kantoren'::public.asset_class
    WHEN 'winkelpand'           THEN 'winkels'::public.asset_class
    WHEN 'woon_winkelpand'      THEN 'mixed_use'::public.asset_class
    WHEN 'bedrijfscomplex'      THEN 'bedrijfshallen'::public.asset_class
    WHEN 'light_industrial'     THEN 'industrieel'::public.asset_class
    WHEN 'logistiek'            THEN 'logistiek'::public.asset_class
    WHEN 'zorgvastgoed'         THEN 'zorgvastgoed'::public.asset_class
    WHEN 'transformatieobject'  THEN 'ontwikkellocatie'::public.asset_class
    WHEN 'ontwikkellocatie'     THEN 'ontwikkellocatie'::public.asset_class
    WHEN 'vastgoedportefeuille' THEN 'wonen'::public.asset_class
    ELSE                             'mixed_use'::public.asset_class
  END;

  INSERT INTO public.objecten (
    objectnaam, plaats, provincie, type_vastgoed, vraagprijs,
    bron, eigenaar_relatie_id, samenvatting, interne_opmerkingen, status
  ) VALUES (
    s.titel,
    s.plaats,
    s.provincie,
    v_asset,
    CASE WHEN s.indicatieve_waarde IS NULL THEN NULL ELSE s.indicatieve_waarde::bigint END,
    'off_market_radar',
    s.eigenaar_relatie_id,
    s.omschrijving,
    s.notities,
    'nieuw'::public.object_status
  )
  RETURNING id INTO v_object_id;

  UPDATE public.off_market_signalen
     SET gekoppeld_object_id = v_object_id,
         status              = 'object_ontvangen'::public.off_market_status,
         updated_at          = now()
   WHERE id = _signaal_id;

  RETURN v_object_id;
END;
$$;

REVOKE ALL ON FUNCTION public.off_market_promote_to_object(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.off_market_promote_to_object(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_promote_to_object(uuid) TO service_role;
