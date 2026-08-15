
-- =====================================================================
-- BITO VASTGOED — UITGEBREID DATAMODEL (FASE 2 - STAP 1: SCHEMA)
-- =====================================================================

-- ---------- ENUM-UITBREIDINGEN ---------------------------------------
ALTER TYPE public.asset_class ADD VALUE IF NOT EXISTS 'zorgvastgoed';
ALTER TYPE public.asset_class ADD VALUE IF NOT EXISTS 'mixed_use';
ALTER TYPE public.asset_class ADD VALUE IF NOT EXISTS 'ontwikkellocatie';
ALTER TYPE public.zoekprofiel_status ADD VALUE IF NOT EXISTS 'pauze';

-- ---------- NIEUWE ENUMS ---------------------------------------------
DO $$ BEGIN CREATE TYPE public.investeerder_subtype AS ENUM ('private_belegger','hnwi','family_office','institutioneel','fonds','bv','nv','cv'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.kapitaal_situatie AS ENUM ('cash_ready','financiering_vereist','hybride','onbekend'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.communicatie_kanaal AS ENUM ('whatsapp','email','telefoon','signal','linkedin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dealstructuur AS ENUM ('direct','jv','fonds','asset_deal','share_deal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.transactietype AS ENUM ('losse_aankoop','portefeuille','jv','asset_deal','share_deal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.exclusiviteit_voorkeur AS ENUM ('alleen_off_market','beide','geen_voorkeur'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dd_status AS ENUM ('niet_gestart','in_uitvoering','afgerond','niet_van_toepassing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.indexatie_basis AS ENUM ('CPI','vast_pct','geen','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.onderhoudsstaat_niveau AS ENUM ('uitstekend','goed','redelijk','matig','slecht'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.verkoper_via AS ENUM ('rechtstreeks_eigenaar','via_makelaar','via_beheerder','via_adviseur','via_netwerk','onbekend'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.energielabel_v2 AS ENUM ('A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.document_type AS ENUM ('huurovereenkomst','taxatierapport','mjop','asbestinventarisatie','bouwkundig_rapport','energielabel_rapport','informatiememorandum','plattegrond','kadasterbericht','wozbeschikking','jaarrekening_huurder','fotorapport','dd_overzicht','anders'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- RELATIES -------------------------------------------------
ALTER TABLE public.relaties
  ADD COLUMN IF NOT EXISTS investeerder_subtype public.investeerder_subtype,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS kvk_nummer TEXT,
  ADD COLUMN IF NOT EXISTS vestigingsadres TEXT,
  ADD COLUMN IF NOT EXISTS vestigingspostcode TEXT,
  ADD COLUMN IF NOT EXISTS vestigingsplaats TEXT,
  ADD COLUMN IF NOT EXISTS vestigingsland TEXT DEFAULT 'NL',
  ADD COLUMN IF NOT EXISTS rendementseis NUMERIC,
  ADD COLUMN IF NOT EXISTS kapitaalsituatie public.kapitaal_situatie DEFAULT 'onbekend',
  ADD COLUMN IF NOT EXISTS eigen_vermogen_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS voorkeur_dealstructuur public.dealstructuur[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS voorkeur_kanaal public.communicatie_kanaal,
  ADD COLUMN IF NOT EXISTS voorkeur_taal TEXT DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS nda_getekend BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nda_datum DATE,
  ADD COLUMN IF NOT EXISTS bron_relatie TEXT,
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- ---------- OBJECTEN -------------------------------------------------
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS anoniem BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publieke_naam TEXT,
  ADD COLUMN IF NOT EXISTS publieke_regio TEXT,
  ADD COLUMN IF NOT EXISTS subcategorie_id UUID,
  ADD COLUMN IF NOT EXISTS netto_aanvangsrendement NUMERIC,
  ADD COLUMN IF NOT EXISTS noi BIGINT,
  ADD COLUMN IF NOT EXISTS servicekosten_jaar BIGINT,
  ADD COLUMN IF NOT EXISTS woz_waarde BIGINT,
  ADD COLUMN IF NOT EXISTS woz_peildatum DATE,
  ADD COLUMN IF NOT EXISTS taxatiewaarde BIGINT,
  ADD COLUMN IF NOT EXISTS taxatiedatum DATE,
  ADD COLUMN IF NOT EXISTS oppervlakte_gbo INTEGER,
  ADD COLUMN IF NOT EXISTS energielabel_v2 public.energielabel_v2,
  ADD COLUMN IF NOT EXISTS huidig_gebruik TEXT,
  ADD COLUMN IF NOT EXISTS aantal_verdiepingen INTEGER,
  ADD COLUMN IF NOT EXISTS aantal_units INTEGER,
  ADD COLUMN IF NOT EXISTS onderhoudsstaat_niveau public.onderhoudsstaat_niveau,
  ADD COLUMN IF NOT EXISTS recente_investeringen TEXT,
  ADD COLUMN IF NOT EXISTS achterstallig_onderhoud TEXT,
  ADD COLUMN IF NOT EXISTS asbestinventarisatie_aanwezig BOOLEAN,
  ADD COLUMN IF NOT EXISTS kadastrale_gemeente TEXT,
  ADD COLUMN IF NOT EXISTS kadastrale_sectie TEXT,
  ADD COLUMN IF NOT EXISTS kadastraal_nummer TEXT,
  ADD COLUMN IF NOT EXISTS investeringsthese TEXT,
  ADD COLUMN IF NOT EXISTS risicos TEXT,
  ADD COLUMN IF NOT EXISTS onderscheidende_kenmerken TEXT,
  ADD COLUMN IF NOT EXISTS verkoper_naam TEXT,
  ADD COLUMN IF NOT EXISTS verkoper_rol TEXT,
  ADD COLUMN IF NOT EXISTS verkoper_via public.verkoper_via,
  ADD COLUMN IF NOT EXISTS verkoper_telefoon TEXT,
  ADD COLUMN IF NOT EXISTS verkoper_email TEXT,
  ADD COLUMN IF NOT EXISTS verkoopmotivatie TEXT,
  ADD COLUMN IF NOT EXISTS is_portefeuille BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_object_id UUID,
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- ---------- ZOEKPROFIELEN --------------------------------------------
ALTER TABLE public.zoekprofielen
  ADD COLUMN IF NOT EXISTS subcategorie_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bouwjaar_min INTEGER,
  ADD COLUMN IF NOT EXISTS bouwjaar_max INTEGER,
  ADD COLUMN IF NOT EXISTS energielabel_min public.energielabel_v2,
  ADD COLUMN IF NOT EXISTS walt_min NUMERIC,
  ADD COLUMN IF NOT EXISTS leegstand_max_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS transactietype_voorkeur public.transactietype[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclusiviteit_voorkeur public.exclusiviteit_voorkeur DEFAULT 'geen_voorkeur',
  ADD COLUMN IF NOT EXISTS prioriteit SMALLINT NOT NULL DEFAULT 3;

-- ---------- DEALS ----------------------------------------------------
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS verwachte_closingdatum DATE,
  ADD COLUMN IF NOT EXISTS commissie_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS commissie_bedrag BIGINT,
  ADD COLUMN IF NOT EXISTS fee_structuur TEXT,
  ADD COLUMN IF NOT EXISTS dd_status public.dd_status DEFAULT 'niet_gestart',
  ADD COLUMN IF NOT EXISTS notaris TEXT,
  ADD COLUMN IF NOT EXISTS bank TEXT,
  ADD COLUMN IF NOT EXISTS tegenpartij_makelaar TEXT,
  ADD COLUMN IF NOT EXISTS afwijzingsreden TEXT,
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- ---------- TAKEN ----------------------------------------------------
ALTER TABLE public.taken
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- ---------- TABEL: object_subcategorieen -----------------------------
CREATE TABLE IF NOT EXISTS public.object_subcategorieen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class public.asset_class NOT NULL,
  subcategorie_key TEXT NOT NULL,
  label TEXT NOT NULL,
  beschrijving TEXT,
  volgorde INTEGER NOT NULL DEFAULT 0,
  actief BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_class, subcategorie_key)
);
ALTER TABLE public.object_subcategorieen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Iedereen leest subcategorieen"
  ON public.object_subcategorieen FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Admin beheert subcategorieen ins"
  ON public.object_subcategorieen FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin beheert subcategorieen upd"
  ON public.object_subcategorieen FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin beheert subcategorieen del"
  ON public.object_subcategorieen FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_object_subcategorieen_updated
  BEFORE UPDATE ON public.object_subcategorieen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- TABEL: relatie_contactpersonen ---------------------------
CREATE TABLE IF NOT EXISTS public.relatie_contactpersonen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relatie_id UUID NOT NULL REFERENCES public.relaties(id) ON DELETE CASCADE,
  naam TEXT NOT NULL,
  functie TEXT,
  email TEXT,
  telefoon TEXT,
  linkedin_url TEXT,
  is_primair BOOLEAN NOT NULL DEFAULT false,
  decision_maker BOOLEAN NOT NULL DEFAULT false,
  voorkeur_kanaal public.communicatie_kanaal,
  voorkeur_taal TEXT DEFAULT 'nl',
  notities TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.relatie_contactpersonen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest contactpersonen"      ON public.relatie_contactpersonen FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt contactpersonen toe"  ON public.relatie_contactpersonen FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt contactpersonen"    ON public.relatie_contactpersonen FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert contactpersonen" ON public.relatie_contactpersonen FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_contactpersonen_relatie ON public.relatie_contactpersonen(relatie_id);
CREATE TRIGGER trg_relatie_contactpersonen_updated
  BEFORE UPDATE ON public.relatie_contactpersonen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- TABEL: object_huurders -----------------------------------
CREATE TABLE IF NOT EXISTS public.object_huurders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES public.objecten(id) ON DELETE CASCADE,
  huurder_naam TEXT NOT NULL,
  branche TEXT,
  oppervlakte_m2 INTEGER,
  jaarhuur BIGINT,
  servicekosten_jaar BIGINT,
  ingangsdatum DATE,
  einddatum DATE,
  opzegmogelijkheid TEXT,
  indexatie_basis public.indexatie_basis,
  indexatie_pct NUMERIC,
  notities TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.object_huurders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest huurders"      ON public.object_huurders FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt huurders"      ON public.object_huurders FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt huurders"    ON public.object_huurders FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert huurders" ON public.object_huurders FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_huurders_object ON public.object_huurders(object_id);
CREATE TRIGGER trg_object_huurders_updated
  BEFORE UPDATE ON public.object_huurders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- TABEL: object_documenten ---------------------------------
CREATE TABLE IF NOT EXISTS public.object_documenten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES public.objecten(id) ON DELETE CASCADE,
  documenttype public.document_type NOT NULL DEFAULT 'anders',
  bestandsnaam TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  bestandsgrootte_bytes BIGINT,
  mime_type TEXT,
  vertrouwelijk BOOLEAN NOT NULL DEFAULT true,
  notities TEXT,
  geupload_door UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.object_documenten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest documenten"      ON public.object_documenten FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt documenten"      ON public.object_documenten FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt documenten"    ON public.object_documenten FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert documenten" ON public.object_documenten FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_documenten_object ON public.object_documenten(object_id);

-- ---------- TABEL: object_fotos --------------------------------------
CREATE TABLE IF NOT EXISTS public.object_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES public.objecten(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  bijschrift TEXT,
  is_hoofdfoto BOOLEAN NOT NULL DEFAULT false,
  volgorde INTEGER NOT NULL DEFAULT 0,
  bestandsgrootte_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.object_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest fotos"      ON public.object_fotos FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt fotos"      ON public.object_fotos FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt fotos"    ON public.object_fotos FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert fotos" ON public.object_fotos FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_fotos_object ON public.object_fotos(object_id);
CREATE TRIGGER trg_object_fotos_updated
  BEFORE UPDATE ON public.object_fotos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- VIEW: object_huur_metrics --------------------------------
CREATE OR REPLACE VIEW public.object_huur_metrics
WITH (security_invoker = true) AS
SELECT
  o.id AS object_id,
  COALESCE(COUNT(h.id), 0)::INTEGER AS aantal_huurders,
  COALESCE(SUM(h.jaarhuur), 0)::BIGINT AS totale_jaarhuur,
  COALESCE(SUM(h.oppervlakte_m2), 0)::INTEGER AS verhuurde_m2,
  CASE WHEN SUM(h.jaarhuur) > 0 THEN
    ROUND(
      SUM(EXTRACT(EPOCH FROM (h.einddatum::timestamp - now())) / 31557600.0 * h.jaarhuur)::numeric
      / NULLIF(SUM(h.jaarhuur), 0), 2
    )
  END AS walt_jaren,
  CASE WHEN SUM(h.jaarhuur) > 0 THEN
    ROUND(
      SUM(EXTRACT(EPOCH FROM (h.einddatum::timestamp - now())) / 31557600.0 * h.jaarhuur)::numeric
      / NULLIF(SUM(h.jaarhuur), 0), 2
    )
  END AS walb_jaren
FROM public.objecten o
LEFT JOIN public.object_huurders h ON h.object_id = o.id
GROUP BY o.id;

-- ---------- STORAGE BUCKET: bito-objecten ----------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('bito-objecten', 'bito-objecten', false, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Intern leest bito-objecten"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bito-objecten' AND public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern uploadt bito-objecten"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bito-objecten' AND public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt bito-objecten"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bito-objecten' AND public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert bito-objecten"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bito-objecten' AND public.is_intern_gebruiker(auth.uid()));
