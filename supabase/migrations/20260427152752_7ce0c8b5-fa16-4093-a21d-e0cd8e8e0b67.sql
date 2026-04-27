-- Pipeline fases (17 stappen + afgevallen)
CREATE TYPE public.pipeline_fase AS ENUM (
  'match_gevonden',
  'teaser_verstuurd',
  'interesse_ontvangen',
  'nda_verstuurd',
  'nda_getekend',
  'informatie_gedeeld',
  'bezichtiging_gepland',
  'bezichtiging_geweest',
  'indicatieve_bieding',
  'onderhandeling',
  'loi_ontvangen',
  'due_diligence',
  'koopovereenkomst_concept',
  'koopovereenkomst_getekend',
  'transport_closing',
  'afgerond',
  'afgevallen'
);

CREATE TYPE public.interesse_niveau AS ENUM ('koud','lauw','warm','zeer_warm');

CREATE TYPE public.volgende_actie_type AS ENUM (
  'bellen','mailen','whatsapp','nda_sturen','stukken_delen',
  'bezichtiging_plannen','bieding_opvolgen','onderhandelen','overig'
);

CREATE TABLE public.object_pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  object_id UUID NOT NULL,
  relatie_id UUID NOT NULL,
  zoekprofiel_id UUID,

  pipeline_fase public.pipeline_fase NOT NULL DEFAULT 'match_gevonden',
  interesse_niveau public.interesse_niveau NOT NULL DEFAULT 'lauw',
  matchscore SMALLINT,

  teaser_verstuurd BOOLEAN NOT NULL DEFAULT false,
  teaser_verstuurd_op DATE,
  nda_verstuurd BOOLEAN NOT NULL DEFAULT false,
  nda_verstuurd_op DATE,
  nda_getekend BOOLEAN NOT NULL DEFAULT false,
  nda_getekend_op DATE,
  informatie_gedeeld BOOLEAN NOT NULL DEFAULT false,
  informatie_gedeeld_op DATE,

  bezichtiging_datum DATE,
  bieding_bedrag BIGINT,
  bieding_voorwaarden TEXT,
  financieringsvoorbehoud BOOLEAN,
  gewenste_levering DATE,
  fee_akkoord BOOLEAN NOT NULL DEFAULT false,

  laatste_contactdatum DATE,
  volgende_actie public.volgende_actie_type,
  volgende_actie_omschrijving TEXT,
  volgende_actie_datum DATE,

  notities TEXT,
  reden_afgevallen TEXT,

  aangemaakt_door UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  soft_deleted_at TIMESTAMPTZ,

  UNIQUE (object_id, relatie_id)
);

CREATE INDEX idx_object_pipeline_object ON public.object_pipeline(object_id) WHERE soft_deleted_at IS NULL;
CREATE INDEX idx_object_pipeline_relatie ON public.object_pipeline(relatie_id) WHERE soft_deleted_at IS NULL;
CREATE INDEX idx_object_pipeline_fase ON public.object_pipeline(pipeline_fase) WHERE soft_deleted_at IS NULL;
CREATE INDEX idx_object_pipeline_volgende_actie ON public.object_pipeline(volgende_actie_datum) WHERE soft_deleted_at IS NULL;

ALTER TABLE public.object_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest object_pipeline"
  ON public.object_pipeline FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern voegt object_pipeline toe"
  ON public.object_pipeline FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern wijzigt object_pipeline"
  ON public.object_pipeline FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern verwijdert object_pipeline"
  ON public.object_pipeline FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_object_pipeline_updated
  BEFORE UPDATE ON public.object_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();