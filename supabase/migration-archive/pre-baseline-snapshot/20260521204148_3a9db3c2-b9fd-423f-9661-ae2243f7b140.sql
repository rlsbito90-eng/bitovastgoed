
-- Checklist-items per object
CREATE TABLE public.object_dossier_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL,
  category text NOT NULL,
  item_key text NOT NULL,
  label text,
  status text,
  notitie text,
  bron text,
  opgevraagd_op date,
  document_id uuid,
  weight smallint NOT NULL DEFAULT 1,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_id, item_key)
);
CREATE INDEX idx_dossier_items_object ON public.object_dossier_items(object_id);

ALTER TABLE public.object_dossier_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest object_dossier_items" ON public.object_dossier_items
  FOR SELECT TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt object_dossier_items toe" ON public.object_dossier_items
  FOR INSERT TO authenticated WITH CHECK (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt object_dossier_items" ON public.object_dossier_items
  FOR UPDATE TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert object_dossier_items" ON public.object_dossier_items
  FOR DELETE TO authenticated USING (is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_dossier_items_updated_at BEFORE UPDATE ON public.object_dossier_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aanbiedingsteksten per object (1 rij per object)
CREATE TABLE public.object_aanbiedingsteksten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL UNIQUE,
  korte_teaser text,
  whatsapp_tekst text,
  email_tekst text,
  uitgebreide_omschrijving text,
  highlights text,
  externe_aandachtspunten text,
  fee_tekst text,
  nda_tekst text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.object_aanbiedingsteksten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest object_aanbiedingsteksten" ON public.object_aanbiedingsteksten
  FOR SELECT TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt object_aanbiedingsteksten toe" ON public.object_aanbiedingsteksten
  FOR INSERT TO authenticated WITH CHECK (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt object_aanbiedingsteksten" ON public.object_aanbiedingsteksten
  FOR UPDATE TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert object_aanbiedingsteksten" ON public.object_aanbiedingsteksten
  FOR DELETE TO authenticated USING (is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_aanbiedingsteksten_updated_at BEFORE UPDATE ON public.object_aanbiedingsteksten
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aandachtspunten per object
CREATE TABLE public.object_aandachtspunten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL,
  titel text NOT NULL,
  type text,
  ernst text,
  intern_only boolean NOT NULL DEFAULT true,
  notitie text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aandachtspunten_object ON public.object_aandachtspunten(object_id);

ALTER TABLE public.object_aandachtspunten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest object_aandachtspunten" ON public.object_aandachtspunten
  FOR SELECT TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt object_aandachtspunten toe" ON public.object_aandachtspunten
  FOR INSERT TO authenticated WITH CHECK (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt object_aandachtspunten" ON public.object_aandachtspunten
  FOR UPDATE TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert object_aandachtspunten" ON public.object_aandachtspunten
  FOR DELETE TO authenticated USING (is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_aandachtspunten_updated_at BEFORE UPDATE ON public.object_aandachtspunten
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
