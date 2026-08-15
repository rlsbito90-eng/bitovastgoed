-- =====================================================
-- BITO VASTGOED - INITIAL SCHEMA
-- =====================================================

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'medewerker');
CREATE TYPE public.relatie_type AS ENUM ('belegger', 'ontwikkelaar', 'eigenaar', 'makelaar', 'partner', 'overig');
CREATE TYPE public.lead_status AS ENUM ('koud', 'lauw', 'warm', 'actief');
CREATE TYPE public.asset_class AS ENUM ('wonen', 'winkels', 'bedrijfshallen', 'logistiek', 'industrieel', 'kantoren', 'hotels');
CREATE TYPE public.verhuur_status AS ENUM ('verhuurd', 'leeg', 'gedeeltelijk');
CREATE TYPE public.deal_fase AS ENUM ('lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing', 'afgerond', 'afgevallen');
CREATE TYPE public.taak_prioriteit AS ENUM ('laag', 'normaal', 'hoog', 'urgent');
CREATE TYPE public.taak_status AS ENUM ('open', 'in_uitvoering', 'afgerond');
CREATE TYPE public.zoekprofiel_status AS ENUM ('actief', 'gepauzeerd', 'gearchiveerd');
CREATE TYPE public.object_status AS ENUM ('nieuw', 'in_voorbereiding', 'beschikbaar', 'in_onderhandeling', 'verkocht', 'ingetrokken');

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  volledige_naam TEXT,
  telefoon TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER ROLES (separate table - critical for security)
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_intern_gebruiker(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- =====================================================
-- TIMESTAMP TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- (no automatic role - admin must assign)
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bestaande_gebruikers INT;
BEGIN
  INSERT INTO public.profiles (id, email, volledige_naam)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'volledige_naam', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  -- Eerste gebruiker in het systeem wordt automatisch admin
  SELECT COUNT(*) INTO bestaande_gebruikers FROM public.user_roles;
  IF bestaande_gebruikers = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- RELATIES
-- =====================================================
CREATE TABLE public.relaties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bedrijfsnaam TEXT NOT NULL,
  contactpersoon TEXT,
  type_partij public.relatie_type NOT NULL DEFAULT 'belegger',
  telefoon TEXT,
  email TEXT,
  regio TEXT[] DEFAULT '{}',
  asset_classes public.asset_class[] DEFAULT '{}',
  budget_min BIGINT,
  budget_max BIGINT,
  aankoopcriteria TEXT,
  verkoopintentie TEXT,
  lead_status public.lead_status NOT NULL DEFAULT 'lauw',
  laatste_contactdatum DATE,
  volgende_actie TEXT,
  notities TEXT,
  verantwoordelijke_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aangemaakt_door UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.relaties ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_relaties_lead_status ON public.relaties(lead_status);
CREATE INDEX idx_relaties_type ON public.relaties(type_partij);
CREATE TRIGGER trg_relaties_updated BEFORE UPDATE ON public.relaties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ZOEKPROFIELEN
-- =====================================================
CREATE TABLE public.zoekprofielen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relatie_id UUID NOT NULL REFERENCES public.relaties(id) ON DELETE CASCADE,
  profielnaam TEXT NOT NULL,
  type_vastgoed public.asset_class[] DEFAULT '{}',
  regio TEXT[] DEFAULT '{}',
  steden TEXT[] DEFAULT '{}',
  prijs_min BIGINT,
  prijs_max BIGINT,
  oppervlakte_min INT,
  oppervlakte_max INT,
  verhuur_voorkeur public.verhuur_status,
  rendementseis NUMERIC(5,2),
  ontwikkelpotentie BOOLEAN DEFAULT false,
  transformatiepotentie BOOLEAN DEFAULT false,
  object_of_portefeuille TEXT DEFAULT 'object',
  aanvullende_criteria TEXT,
  status public.zoekprofiel_status NOT NULL DEFAULT 'actief',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zoekprofielen ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_zoekprofielen_relatie ON public.zoekprofielen(relatie_id);
CREATE TRIGGER trg_zoekprofielen_updated BEFORE UPDATE ON public.zoekprofielen FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- OBJECTEN
-- =====================================================
CREATE TABLE public.objecten (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objectnaam TEXT NOT NULL,
  plaats TEXT,
  provincie TEXT,
  type_vastgoed public.asset_class NOT NULL,
  vraagprijs BIGINT,
  huurinkomsten BIGINT,
  aantal_huurders INT,
  verhuurstatus public.verhuur_status,
  oppervlakte INT,
  bouwjaar INT,
  onderhoudsstaat TEXT,
  ontwikkelpotentie BOOLEAN DEFAULT false,
  transformatiepotentie BOOLEAN DEFAULT false,
  bron TEXT,
  exclusief BOOLEAN DEFAULT false,
  intern_vertrouwelijk BOOLEAN DEFAULT true,
  documentatie_beschikbaar BOOLEAN DEFAULT false,
  eigenaar_relatie_id UUID REFERENCES public.relaties(id) ON DELETE SET NULL,
  status public.object_status NOT NULL DEFAULT 'nieuw',
  samenvatting TEXT,
  interne_opmerkingen TEXT,
  aangemaakt_door UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.objecten ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_objecten_type ON public.objecten(type_vastgoed);
CREATE INDEX idx_objecten_status ON public.objecten(status);
CREATE TRIGGER trg_objecten_updated BEFORE UPDATE ON public.objecten FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- DEALS
-- =====================================================
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  object_id UUID NOT NULL REFERENCES public.objecten(id) ON DELETE CASCADE,
  relatie_id UUID NOT NULL REFERENCES public.relaties(id) ON DELETE CASCADE,
  fase public.deal_fase NOT NULL DEFAULT 'lead',
  interessegraad SMALLINT CHECK (interessegraad BETWEEN 1 AND 5) DEFAULT 3,
  datum_eerste_contact DATE NOT NULL DEFAULT CURRENT_DATE,
  datum_follow_up DATE,
  bezichtiging_gepland DATE,
  indicatief_bod BIGINT,
  notities TEXT,
  verantwoordelijke_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deals_object ON public.deals(object_id);
CREATE INDEX idx_deals_relatie ON public.deals(relatie_id);
CREATE INDEX idx_deals_fase ON public.deals(fase);
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TAKEN
-- =====================================================
CREATE TABLE public.taken (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titel TEXT NOT NULL,
  type_taak TEXT,
  relatie_id UUID REFERENCES public.relaties(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  object_id UUID REFERENCES public.objecten(id) ON DELETE CASCADE,
  deadline DATE,
  prioriteit public.taak_prioriteit NOT NULL DEFAULT 'normaal',
  status public.taak_status NOT NULL DEFAULT 'open',
  notities TEXT,
  verantwoordelijke_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aangemaakt_door UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.taken ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_taken_status ON public.taken(status);
CREATE INDEX idx_taken_deadline ON public.taken(deadline);
CREATE TRIGGER trg_taken_updated BEFORE UPDATE ON public.taken FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- NOTITIES (tijdlijn per relatie/object/deal)
-- =====================================================
CREATE TABLE public.notities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inhoud TEXT NOT NULL,
  relatie_id UUID REFERENCES public.relaties(id) ON DELETE CASCADE,
  object_id UUID REFERENCES public.objecten(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  auteur_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notities_relatie ON public.notities(relatie_id);
CREATE INDEX idx_notities_object ON public.notities(object_id);
CREATE INDEX idx_notities_deal ON public.notities(deal_id);

-- =====================================================
-- MATCHES (cache van zoekprofiel <-> object koppelingen)
-- =====================================================
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  object_id UUID NOT NULL REFERENCES public.objecten(id) ON DELETE CASCADE,
  zoekprofiel_id UUID NOT NULL REFERENCES public.zoekprofielen(id) ON DELETE CASCADE,
  matchscore SMALLINT NOT NULL CHECK (matchscore BETWEEN 0 AND 100),
  toelichting TEXT,
  bekeken BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(object_id, zoekprofiel_id)
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_matches_object ON public.matches(object_id);
CREATE INDEX idx_matches_score ON public.matches(matchscore DESC);

-- =====================================================
-- RLS POLICIES
-- Patroon: alle interne gebruikers (admin + medewerker)
-- mogen alle data zien en bewerken. Alleen admins beheren rollen.
-- =====================================================

-- PROFILES
CREATE POLICY "Interne gebruikers zien alle profielen"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Gebruiker werkt eigen profiel bij"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin werkt elk profiel bij"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
CREATE POLICY "Gebruiker ziet eigen rollen"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin ziet alle rollen"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin beheert rollen (insert)"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin beheert rollen (update)"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin beheert rollen (delete)"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Generic helper macro-style policies for intern data tables
-- RELATIES
CREATE POLICY "Intern leest relaties" ON public.relaties FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt relaties toe" ON public.relaties FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt relaties" ON public.relaties FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert relaties" ON public.relaties FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

-- ZOEKPROFIELEN
CREATE POLICY "Intern leest zoekprofielen" ON public.zoekprofielen FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt zoekprofielen toe" ON public.zoekprofielen FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt zoekprofielen" ON public.zoekprofielen FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert zoekprofielen" ON public.zoekprofielen FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

-- OBJECTEN
CREATE POLICY "Intern leest objecten" ON public.objecten FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt objecten toe" ON public.objecten FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt objecten" ON public.objecten FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert objecten" ON public.objecten FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

-- DEALS
CREATE POLICY "Intern leest deals" ON public.deals FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt deals toe" ON public.deals FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt deals" ON public.deals FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert deals" ON public.deals FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

-- TAKEN
CREATE POLICY "Intern leest taken" ON public.taken FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt taken toe" ON public.taken FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt taken" ON public.taken FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert taken" ON public.taken FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

-- NOTITIES
CREATE POLICY "Intern leest notities" ON public.notities FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt notities toe" ON public.notities FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()) AND auteur_id = auth.uid());
CREATE POLICY "Auteur of admin wijzigt notitie" ON public.notities FOR UPDATE TO authenticated USING (auteur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auteur of admin verwijdert notitie" ON public.notities FOR DELETE TO authenticated USING (auteur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- MATCHES
CREATE POLICY "Intern leest matches" ON public.matches FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt matches toe" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt matches" ON public.matches FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert matches" ON public.matches FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));