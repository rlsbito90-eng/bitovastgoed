
CREATE TABLE public.kadaster_documenten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid REFERENCES public.objecten(id) ON DELETE SET NULL,
  signaal_id uuid REFERENCES public.off_market_signalen(id) ON DELETE SET NULL,
  kadaster_data_record_id uuid REFERENCES public.kadaster_data_records(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'kadaster_objectinformatie_api',
  product_codes text[] NOT NULL DEFAULT '{}',
  zoekadres jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  storage_bucket text NOT NULL DEFAULT 'bito-objecten',
  storage_path text NOT NULL,
  bestandsnaam text NOT NULL,
  bestandsgrootte_bytes bigint,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  intern_only boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kadaster_documenten_target_check
    CHECK (object_id IS NOT NULL OR signaal_id IS NOT NULL)
);

CREATE INDEX idx_kadaster_documenten_object_id
  ON public.kadaster_documenten(object_id) WHERE object_id IS NOT NULL;
CREATE INDEX idx_kadaster_documenten_signaal_id
  ON public.kadaster_documenten(signaal_id) WHERE signaal_id IS NOT NULL;
CREATE INDEX idx_kadaster_documenten_record_id
  ON public.kadaster_documenten(kadaster_data_record_id) WHERE kadaster_data_record_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kadaster_documenten TO authenticated;
GRANT ALL ON public.kadaster_documenten TO service_role;

ALTER TABLE public.kadaster_documenten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interne gebruikers kunnen kadaster-documenten bekijken"
  ON public.kadaster_documenten FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen kadaster-documenten toevoegen"
  ON public.kadaster_documenten FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen kadaster-documenten bijwerken"
  ON public.kadaster_documenten FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()))
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen kadaster-documenten verwijderen"
  ON public.kadaster_documenten FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER update_kadaster_documenten_updated_at
  BEFORE UPDATE ON public.kadaster_documenten
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.kadaster_data_records
  ADD COLUMN IF NOT EXISTS pdf_document_id uuid
  REFERENCES public.kadaster_documenten(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kadaster_records_pdf_document_id
  ON public.kadaster_data_records(pdf_document_id) WHERE pdf_document_id IS NOT NULL;
