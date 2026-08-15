-- Tabel jaar_doelen voor commissie- en dealwaarde-doelen per jaar
CREATE TABLE IF NOT EXISTS public.jaar_doelen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jaar INTEGER NOT NULL UNIQUE,
  commissie_doel_bedrag BIGINT,
  dealwaarde_doel_bedrag BIGINT,
  notities TEXT,
  aangemaakt_door UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.jaar_doelen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest jaar_doelen"
  ON public.jaar_doelen FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Admin beheert jaar_doelen ins"
  ON public.jaar_doelen FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin beheert jaar_doelen upd"
  ON public.jaar_doelen FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin beheert jaar_doelen del"
  ON public.jaar_doelen FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_jaar_doelen_updated_at
BEFORE UPDATE ON public.jaar_doelen
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC voor genereren intern referentienummer (BITO-YYYY-NNN)
CREATE OR REPLACE FUNCTION public.generate_refnummer()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jaar INT := EXTRACT(YEAR FROM now())::INT;
  laatste_nr INT;
  nieuw_nr INT;
  prefix TEXT;
BEGIN
  prefix := 'BITO-' || jaar::TEXT || '-';
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(intern_referentienummer, '^BITO-' || jaar::TEXT || '-', ''), '')::INT
  ), 0) INTO laatste_nr
  FROM public.objecten
  WHERE intern_referentienummer LIKE prefix || '%'
    AND intern_referentienummer ~ ('^BITO-' || jaar::TEXT || '-[0-9]+$');
  nieuw_nr := laatste_nr + 1;
  RETURN prefix || lpad(nieuw_nr::TEXT, 3, '0');
END;
$$;