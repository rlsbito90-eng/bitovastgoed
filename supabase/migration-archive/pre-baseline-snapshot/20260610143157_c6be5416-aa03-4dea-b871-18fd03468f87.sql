
CREATE TABLE public.kadaster_data_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NULL REFERENCES public.objecten(id) ON DELETE SET NULL,
  signaal_id uuid NULL REFERENCES public.off_market_signalen(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'kadaster_objectinformatie_api',
  mode text NOT NULL DEFAULT 'kadaster',
  product_code text NOT NULL,
  status text NOT NULL,
  zoekadres jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),

  -- Koopsom
  koopsom bigint NULL,
  koopjaar int NULL,
  koopsom_valuta text NULL,
  meer_onroerend_goed boolean NULL,
  doelbinding boolean NULL,

  -- BAG
  bag_bouwjaar int NULL,
  bag_oppervlakte int NULL,
  bag_object_status text NULL,
  bag_gebruiksdoel text NULL,

  -- WOZ-object
  woz_objectnummer text NULL,
  woz_oppervlakte int NULL,
  woz_oppervlakte_wonen int NULL,
  woz_oppervlakte_niet_wonen int NULL,
  woz_inhoud int NULL,
  woz_gebruiksklasse text NULL,
  feitelijk_gebruik text NULL,
  monumentaanduiding text NULL,
  actualiteit text NULL,

  -- Rechten / eigendomsinformatie (voorzichtig)
  rechten_samenvatting jsonb NULL,
  rechthebbende_naam text NULL,
  rechthebbende_type text NULL,
  rechtsoort text NULL,
  aandeel text NULL,
  kadastrale_aanduiding text NULL,

  -- Raw beperkt
  raw_limited jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT kadaster_data_records_target_check
    CHECK (object_id IS NOT NULL OR signaal_id IS NOT NULL),
  CONSTRAINT kadaster_data_records_product_code_check
    CHECK (product_code <> ''),
  CONSTRAINT kadaster_data_records_status_check
    CHECK (status IN ('geleverd','gedeeltelijk','niet_geleverd','niet_beschikbaar','fout'))
);

GRANT SELECT, INSERT, UPDATE ON public.kadaster_data_records TO authenticated;
GRANT ALL ON public.kadaster_data_records TO service_role;

ALTER TABLE public.kadaster_data_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interne gebruikers kunnen kadaster-records bekijken"
  ON public.kadaster_data_records FOR SELECT
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen kadaster-records toevoegen"
  ON public.kadaster_data_records FOR INSERT
  TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen kadaster-records bijwerken"
  ON public.kadaster_data_records FOR UPDATE
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()))
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE INDEX idx_kadaster_records_object_id
  ON public.kadaster_data_records(object_id) WHERE object_id IS NOT NULL;
CREATE INDEX idx_kadaster_records_signaal_id
  ON public.kadaster_data_records(signaal_id) WHERE signaal_id IS NOT NULL;
CREATE INDEX idx_kadaster_records_object_product_fetched
  ON public.kadaster_data_records(object_id, product_code, fetched_at DESC)
  WHERE object_id IS NOT NULL;
CREATE INDEX idx_kadaster_records_signaal_product_fetched
  ON public.kadaster_data_records(signaal_id, product_code, fetched_at DESC)
  WHERE signaal_id IS NOT NULL;
CREATE INDEX idx_kadaster_records_fetched_at
  ON public.kadaster_data_records(fetched_at DESC);

CREATE TRIGGER update_kadaster_data_records_updated_at
  BEFORE UPDATE ON public.kadaster_data_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
