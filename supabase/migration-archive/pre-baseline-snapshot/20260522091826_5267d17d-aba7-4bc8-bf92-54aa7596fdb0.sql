
-- Enums voor biedingen
CREATE TYPE public.biedingstatus AS ENUM (
  'concept','ontvangen','in_behandeling','tegenvoorstel_gedaan',
  'aangepast_bod_gevraagd','geaccepteerd','afgewezen','ingetrokken','verlopen'
);

CREATE TYPE public.biedingtype AS ENUM (
  'indicatief','openingsbod','voorwaardelijk','onvoorwaardelijk',
  'eindbod','tegenvoorstel','verhoogd_bod','schriftelijk','mondeling'
);

CREATE TYPE public.voorbehoud_status AS ENUM (
  'geen','ja','onbekend','nader_te_bepalen'
);

-- Hoofdtabel biedingen
CREATE TABLE public.biedingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL,
  relatie_id uuid NOT NULL,
  deal_id uuid,
  object_pipeline_id uuid,
  counter_offer_to_id uuid,
  bedrag bigint,
  currency text NOT NULL DEFAULT 'EUR',
  bieddatum date NOT NULL DEFAULT CURRENT_DATE,
  geldig_tot date,
  status public.biedingstatus NOT NULL DEFAULT 'concept',
  offer_type public.biedingtype NOT NULL DEFAULT 'indicatief',
  financieringsvoorbehoud public.voorbehoud_status NOT NULL DEFAULT 'onbekend',
  dd_voorbehoud public.voorbehoud_status NOT NULL DEFAULT 'onbekend',
  gewenste_levering date,
  gewenste_levering_tekst text,
  waarborgsom_bedrag bigint,
  waarborgsom_pct numeric,
  kosten_type text,
  voorwaarden text,
  notities text,
  interne_notities text,
  bron text,
  is_best_offer boolean NOT NULL DEFAULT false,
  is_final_offer boolean NOT NULL DEFAULT false,
  rejected_reason text,
  accepted_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  expired_at timestamptz,
  aangemaakt_door uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_biedingen_object ON public.biedingen(object_id);
CREATE INDEX idx_biedingen_relatie ON public.biedingen(relatie_id);
CREATE INDEX idx_biedingen_deal ON public.biedingen(deal_id);
CREATE INDEX idx_biedingen_status ON public.biedingen(status);
CREATE INDEX idx_biedingen_pipeline ON public.biedingen(object_pipeline_id);
CREATE INDEX idx_biedingen_counter ON public.biedingen(counter_offer_to_id);

ALTER TABLE public.biedingen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest biedingen" ON public.biedingen
  FOR SELECT TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt biedingen toe" ON public.biedingen
  FOR INSERT TO authenticated WITH CHECK (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt biedingen" ON public.biedingen
  FOR UPDATE TO authenticated USING (is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert biedingen" ON public.biedingen
  FOR DELETE TO authenticated USING (is_intern_gebruiker(auth.uid()));

CREATE TRIGGER update_biedingen_updated_at
  BEFORE UPDATE ON public.biedingen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
