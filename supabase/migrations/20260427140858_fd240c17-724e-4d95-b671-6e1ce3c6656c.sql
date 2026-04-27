-- =====================================================================
-- 1. NIEUWE TABELLEN
-- =====================================================================

CREATE TABLE public.property_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.property_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_type_id uuid NOT NULL REFERENCES public.property_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_type_id, slug)
);

CREATE TABLE public.deal_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.property_type_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  mapped_property_type_id uuid REFERENCES public.property_types(id) ON DELETE CASCADE,
  mapped_property_subtype_id uuid REFERENCES public.property_subtypes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alias)
);

CREATE INDEX idx_property_subtypes_type ON public.property_subtypes(property_type_id);
CREATE INDEX idx_property_aliases_alias ON public.property_type_aliases(lower(alias));

-- =====================================================================
-- 2. RLS
-- =====================================================================

ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_subtypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_type_aliases ENABLE ROW LEVEL SECURITY;

-- property_types
CREATE POLICY "Intern leest property_types" ON public.property_types
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Admin beheert property_types ins" ON public.property_types
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert property_types upd" ON public.property_types
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert property_types del" ON public.property_types
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- property_subtypes
CREATE POLICY "Intern leest property_subtypes" ON public.property_subtypes
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Admin beheert property_subtypes ins" ON public.property_subtypes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert property_subtypes upd" ON public.property_subtypes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert property_subtypes del" ON public.property_subtypes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- deal_types
CREATE POLICY "Intern leest deal_types" ON public.deal_types
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Admin beheert deal_types ins" ON public.deal_types
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert deal_types upd" ON public.deal_types
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert deal_types del" ON public.deal_types
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- property_type_aliases
CREATE POLICY "Intern leest property_type_aliases" ON public.property_type_aliases
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Admin beheert property_type_aliases ins" ON public.property_type_aliases
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert property_type_aliases upd" ON public.property_type_aliases
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin beheert property_type_aliases del" ON public.property_type_aliases
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- 3. NIEUWE KOLOMMEN OP BESTAANDE TABELLEN
-- =====================================================================

ALTER TABLE public.objecten
  ADD COLUMN property_type_id uuid REFERENCES public.property_types(id) ON DELETE SET NULL,
  ADD COLUMN property_subtype_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN deal_type_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.zoekprofielen
  ADD COLUMN property_type_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN property_subtype_ids_v2 uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN deal_type_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.relaties
  ADD COLUMN property_type_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN property_subtype_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX idx_objecten_property_type ON public.objecten(property_type_id);
CREATE INDEX idx_objecten_property_subtypes ON public.objecten USING GIN(property_subtype_ids);
CREATE INDEX idx_objecten_deal_types ON public.objecten USING GIN(deal_type_ids);
CREATE INDEX idx_zoekprofielen_property_types ON public.zoekprofielen USING GIN(property_type_ids);
CREATE INDEX idx_zoekprofielen_property_subtypes_v2 ON public.zoekprofielen USING GIN(property_subtype_ids_v2);
CREATE INDEX idx_zoekprofielen_deal_types ON public.zoekprofielen USING GIN(deal_type_ids);
CREATE INDEX idx_relaties_property_types ON public.relaties USING GIN(property_type_ids);
CREATE INDEX idx_relaties_property_subtypes ON public.relaties USING GIN(property_subtype_ids);

-- =====================================================================
-- 4. SEED PROPERTY_TYPES (17)
-- =====================================================================

INSERT INTO public.property_types (name, slug, sort_order) VALUES
  ('Residentieel beleggingsvastgoed', 'residentieel', 10),
  ('Commercieel vastgoed', 'commercieel', 20),
  ('Kantoorvastgoed', 'kantoor', 30),
  ('Retail / winkelvastgoed', 'retail', 40),
  ('Bedrijfsruimte / industrial', 'bedrijfsruimte', 50),
  ('Logistiek vastgoed', 'logistiek', 60),
  ('Light industrial', 'light_industrial', 70),
  ('Zorgvastgoed', 'zorg', 80),
  ('Leisure / hospitality', 'leisure', 90),
  ('Mixed-use vastgoed', 'mixed_use', 100),
  ('Ontwikkellocatie / grondpositie', 'ontwikkellocatie', 110),
  ('Transformatieobject', 'transformatie', 120),
  ('Maatschappelijk vastgoed', 'maatschappelijk', 130),
  ('Agrarisch / landelijk vastgoed', 'agrarisch', 140),
  ('Parkeren / mobiliteit', 'parkeren', 150),
  ('Alternatief vastgoed', 'alternatief', 160),
  ('Vastgoedportefeuille', 'portefeuille', 170);

-- =====================================================================
-- 5. SEED PROPERTY_SUBTYPES
-- =====================================================================

-- Residentieel beleggingsvastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Appartementencomplex','appartementencomplex',10),
  ('Appartementen','appartementen',20),
  ('Wooncomplex','wooncomplex',30),
  ('Huurwoningen','huurwoningen',40),
  ('Woningportefeuille','woningportefeuille',50),
  ('Eengezinswoningen','eengezinswoningen',60),
  ('Meerfamiliewoningen','meerfamiliewoningen',70),
  ('Kamerverhuur','kamerverhuur',80),
  ('Studentenhuisvesting','studentenhuisvesting',90),
  ('Studio''s','studios',100),
  ('Short-stay','short_stay',110),
  ('Expatverhuur','expatverhuur',120),
  ('Serviced apartments','serviced_apartments',130),
  ('Seniorenwoningen','seniorenwoningen',140),
  ('Woonzorgappartementen','woonzorgappartementen',150),
  ('Splitsingspand','splitsingspand',160),
  ('Uitpondobject','uitpondobject',170),
  ('Transformatie naar wonen','transformatie_naar_wonen',180),
  ('Woning eigen gebruik','woning_eigen_gebruik',190)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'residentieel';

-- Commercieel vastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Algemeen commercieel vastgoed','algemeen_commercieel',10),
  ('Beleggingspand','beleggingspand',20),
  ('Multi-tenant commercieel object','multi_tenant_commercieel',30),
  ('Single-tenant commercieel object','single_tenant_commercieel',40),
  ('Commerciële plint','commerciele_plint',50),
  ('Commercieel complex','commercieel_complex',60),
  ('Verhuurd commercieel object','verhuurd_commercieel',70),
  ('Leegstaand commercieel object','leegstaand_commercieel',80),
  ('Commercieel vastgoed met ontwikkelpotentie','commercieel_ontwikkelpotentie',90)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'commercieel';

-- Kantoorvastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Kantoorruimte','kantoorruimte',10),
  ('Kantoorgebouw','kantoorgebouw',20),
  ('Multi-tenant kantoor','multi_tenant_kantoor',30),
  ('Single-tenant kantoor','single_tenant_kantoor',40),
  ('Kantoorvilla','kantoorvilla',50),
  ('Flex office','flex_office',60),
  ('Business center','business_center',70),
  ('Co-working kantoor','coworking',80),
  ('Kantoorcampus','kantoorcampus',90),
  ('Hoofdkantoor','hoofdkantoor',100),
  ('Kantoor met baliefunctie','kantoor_balie',110),
  ('Kantoor met showroom','kantoor_showroom',120),
  ('Kantoor met bedrijfsruimte','kantoor_bedrijfsruimte',130),
  ('Leegstaand kantoor','leegstaand_kantoor',140),
  ('Kantoor met transformatiepotentie','kantoor_transformatiepotentie',150)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'kantoor';

-- Retail / winkelvastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Winkelruimte','winkelruimte',10),
  ('Winkelpand','winkelpand',20),
  ('Winkelstrip','winkelstrip',30),
  ('Woon-/winkelpand','woon_winkelpand',40),
  ('High-street retail','high_street',50),
  ('Buurtwinkelcentrum','buurtwinkelcentrum',60),
  ('Wijkwinkelcentrum','wijkwinkelcentrum',70),
  ('Supermarkt','supermarkt',80),
  ('Retailpark','retailpark',90),
  ('Perifere detailhandel / PDV','pdv',100),
  ('Grootschalige detailhandel / GDV','gdv',110),
  ('Showroom','showroom',120),
  ('Dagwinkel','dagwinkel',130),
  ('Horeca-retail combinatie','horeca_retail',140),
  ('Plintcommercieel','plintcommercieel',150),
  ('Leegstaande winkelruimte','leegstaand_winkel',160),
  ('Winkel met bovenwoningen','winkel_bovenwoningen',170)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'retail';

-- Bedrijfsruimte / industrial
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Bedrijfshal','bedrijfshal',10),
  ('Bedrijfsunit','bedrijfsunit',20),
  ('Bedrijfsruimte','bedrijfsruimte',30),
  ('Bedrijfscomplex','bedrijfscomplex',40),
  ('Bedrijfsverzamelgebouw','bedrijfsverzamel',50),
  ('Productieruimte','productieruimte',60),
  ('Werkplaats','werkplaats',70),
  ('Opslagruimte','opslagruimte',80),
  ('Showroom met magazijn','showroom_magazijn',90),
  ('Garagebedrijf','garagebedrijf',100),
  ('Automotive vastgoed','automotive',110),
  ('Ambachtelijke bedrijfsruimte','ambachtelijk',120),
  ('Industriecomplex','industriecomplex',130),
  ('MKB-bedrijfsruimte','mkb_bedrijfsruimte',140),
  ('Bedrijfshal met kantoor','bedrijfshal_kantoor',150),
  ('Bedrijventerreinobject','bedrijventerrein',160),
  ('Solitair bedrijfsgebouw','solitair_bedrijf',170)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'bedrijfsruimte';

-- Logistiek vastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Distributiecentrum','distributiecentrum',10),
  ('Warehouse','warehouse',20),
  ('Logistiek centrum','logistiek_centrum',30),
  ('Last-mile logistiek','last_mile',40),
  ('Crossdock','crossdock',50),
  ('Fulfilment center','fulfilment',60),
  ('E-commerce warehouse','ecommerce_warehouse',70),
  ('Koelhuis','koelhuis',80),
  ('Vrieshuis','vrieshuis',90),
  ('Stadsdistributie','stadsdistributie',100),
  ('XXL-logistiek','xxl_logistiek',110),
  ('Transportterminal','transportterminal',120),
  ('Laad-/loslocatie','laad_loslocatie',130),
  ('Logistiek met kantoor','logistiek_kantoor',140),
  ('Logistieke portefeuille','logistieke_portefeuille',150)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'logistiek';

-- Light industrial
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Kleinschalige bedrijfsunits','kleinschalige_units',10),
  ('Urban industrial','urban_industrial',20),
  ('MKB-units','mkb_units',30),
  ('Flexibele bedrijfsruimte','flex_bedrijfsruimte',40),
  ('Maakindustrie','maakindustrie',50),
  ('Ambachtelijke units','ambachtelijke_units',60),
  ('Light manufacturing','light_manufacturing',70),
  ('Bedrijfsruimte met showroom','bedrijfsruimte_showroom',80),
  ('Bedrijfsruimte met kantoor','bedrijfsruimte_kantoor',90),
  ('Kleine opslagunits','kleine_opslagunits',100),
  ('Bedrijfsverzamelcomplex','bedrijfsverzamel_complex',110),
  ('Garageboxen / kleine units','garageboxen',120)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'light_industrial';

-- Zorgvastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Intramuraal zorgvastgoed','intramuraal',10),
  ('Extramuraal zorgvastgoed','extramuraal',20),
  ('Kleinschalig wonen','kleinschalig_wonen',30),
  ('Zorgappartementen','zorgappartementen',40),
  ('Verpleeghuis','verpleeghuis',50),
  ('Verzorgingshuis','verzorgingshuis',60),
  ('Woonzorgcomplex','woonzorgcomplex',70),
  ('Eerstelijnszorgcentrum','eerstelijnszorg',80),
  ('Huisartsenpraktijk','huisartsenpraktijk',90),
  ('Tandartspraktijk','tandartspraktijk',100),
  ('Fysiotherapiepraktijk','fysiotherapie',110),
  ('Medisch centrum','medisch_centrum',120),
  ('GGZ-locatie','ggz',130),
  ('Jeugdzorglocatie','jeugdzorg',140),
  ('Revalidatiecentrum','revalidatie',150),
  ('Dagbestedingslocatie','dagbesteding',160),
  ('Apotheek','apotheek',170),
  ('Zorgwoningportefeuille','zorgwoningportefeuille',180),
  ('Senioren-/zorgwonen','senior_zorgwonen',190)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'zorg';

-- Leisure / hospitality
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Hotel','hotel',10),
  ('Boutique hotel','boutique_hotel',20),
  ('Hostel','hostel',30),
  ('Short-stay hotel','short_stay_hotel',40),
  ('Restaurant','restaurant',50),
  ('Café','cafe',60),
  ('Horecapand','horecapand',70),
  ('Leisurecomplex','leisurecomplex',80),
  ('Fitness / sportschool','fitness',90),
  ('Wellness','wellness',100),
  ('Recreatiepark','recreatiepark',110),
  ('Vakantiepark','vakantiepark',120),
  ('Camping','camping',130),
  ('Eventlocatie','eventlocatie',140),
  ('Bioscoop / theater','bioscoop_theater',150),
  ('Casino / amusement','casino',160),
  ('Museum / attractie','museum',170),
  ('Sportcomplex','sportcomplex',180)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'leisure';

-- Mixed-use vastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Woon-/winkelpand','woon_winkelpand',10),
  ('Wonen + kantoor','wonen_kantoor',20),
  ('Wonen + horeca','wonen_horeca',30),
  ('Wonen + bedrijfsruimte','wonen_bedrijfsruimte',40),
  ('Retail + kantoor','retail_kantoor',50),
  ('Retail + horeca','retail_horeca',60),
  ('Kantoor + bedrijfsruimte','kantoor_bedrijfsruimte_mix',70),
  ('Kantoor + zorg','kantoor_zorg',80),
  ('Commerciële plint + woningen','plint_woningen',90),
  ('Gemengd stedelijk object','gemengd_stedelijk',100),
  ('Mixed-use complex','mixeduse_complex',110),
  ('Multifunctioneel gebouw','multifunctioneel',120),
  ('Herontwikkelbaar mixed-use object','herontwikkelbaar_mix',130)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'mixed_use';

-- Ontwikkellocatie / grondpositie
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Bouwgrond wonen','bouwgrond_wonen',10),
  ('Bouwgrond commercieel','bouwgrond_commercieel',20),
  ('Bouwgrond logistiek','bouwgrond_logistiek',30),
  ('Bouwgrond zorg','bouwgrond_zorg',40),
  ('Herontwikkelingslocatie','herontwikkelingslocatie',50),
  ('Inbreidingslocatie','inbreidingslocatie',60),
  ('Uitleglocatie','uitleglocatie',70),
  ('Sloop-nieuwbouwlocatie','sloop_nieuwbouw',80),
  ('Vergunde ontwikkeling','vergund',90),
  ('Onvergunde ontwikkeling','onvergund',100),
  ('Planvorming lopend','planvorming',110),
  ('Grondpositie','grondpositie',120),
  ('Strategische grondpositie','strategische_grond',130),
  ('Optiepositie','optiepositie',140),
  ('Transformatiegrond','transformatiegrond',150),
  ('Projectontwikkeling wonen','project_wonen',160),
  ('Projectontwikkeling commercieel','project_commercieel',170),
  ('Projectontwikkeling mixed-use','project_mixeduse',180),
  ('Gebiedsontwikkeling','gebiedsontwikkeling',190)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'ontwikkellocatie';

-- Transformatieobject
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Kantoor naar wonen','kantoor_naar_wonen',10),
  ('Winkel naar wonen','winkel_naar_wonen',20),
  ('Bedrijfsruimte naar wonen','bedrijf_naar_wonen',30),
  ('Kerk naar wonen','kerk_naar_wonen',40),
  ('School naar wonen','school_naar_wonen',50),
  ('Zorgvastgoed naar wonen','zorg_naar_wonen',60),
  ('Hotel naar wonen','hotel_naar_wonen',70),
  ('Maatschappelijk vastgoed naar wonen','maatsch_naar_wonen',80),
  ('Winkel/kantoor naar mixed-use','winkel_kantoor_naar_mix',90),
  ('Leegstaand gebouw met functiewijziging','functiewijziging',100),
  ('Monumentaal transformatieobject','monumentaal_trans',110),
  ('Binnenstedelijke transformatie','binnenstedelijk_trans',120),
  ('Transformatie met vergunning','trans_vergund',130),
  ('Transformatie zonder vergunning','trans_onvergund',140),
  ('Transformatie met bestemmingsplanrisico','trans_bpr_risico',150),
  ('Transformatie met optopping','trans_optopping',160),
  ('Transformatie met splitsingspotentie','trans_splitsing',170)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'transformatie';

-- Maatschappelijk vastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Schoolgebouw','schoolgebouw',10),
  ('Kerk / religieus vastgoed','kerk',20),
  ('Gemeentelijk vastgoed','gemeentelijk',30),
  ('Buurthuis','buurthuis',40),
  ('Cultureel centrum','cultureel_centrum',50),
  ('Sporthal','sporthal',60),
  ('Sportcomplex','sportcomplex_maatsch',70),
  ('Kinderopvang','kinderopvang',80),
  ('Onderwijsgebouw','onderwijsgebouw',90),
  ('Bibliotheek','bibliotheek',100),
  ('Politie-/brandweerkazerne','politie_brandweer',110),
  ('Zorg-/maatschappelijke bestemming','zorg_maatsch_bestemming',120),
  ('Verenigingsgebouw','verenigingsgebouw',130),
  ('Monumentaal maatschappelijk vastgoed','monumentaal_maatsch',140),
  ('Maatschappelijk vastgoed met transformatiepotentie','maatsch_transformatie',150)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'maatschappelijk';

-- Agrarisch / landelijk vastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Agrarische grond','agrarische_grond',10),
  ('Akkerbouwgrond','akkerbouwgrond',20),
  ('Weiland / grasland','weiland',30),
  ('Glastuinbouw','glastuinbouw',40),
  ('Agrarisch bedrijf','agrarisch_bedrijf',50),
  ('Boerderij','boerderij',60),
  ('Hoeve','hoeve',70),
  ('Landgoed','landgoed',80),
  ('Manege','manege',90),
  ('Paardenhouderij','paardenhouderij',100),
  ('Natuurgrond','natuurgrond',110),
  ('Recreatieve grond','recreatieve_grond',120),
  ('Agrarisch object met woonbestemming','agrarisch_woonbestemming',130),
  ('Agrarisch object met transformatiepotentie','agrarisch_transformatie',140)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'agrarisch';

-- Parkeren / mobiliteit
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Parkeergarage','parkeergarage',10),
  ('Parkeerterrein','parkeerterrein',20),
  ('Parkeerplaatsen','parkeerplaatsen',30),
  ('Garageboxen','garageboxen_park',40),
  ('Boxcomplex','boxcomplex',50),
  ('Mobility hub','mobility_hub',60),
  ('Laadplein','laadplein',70),
  ('Tankstation','tankstation',80),
  ('Autowaslocatie','autowas',90),
  ('Automotive service locatie','automotive_service',100)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'parkeren';

-- Alternatief vastgoed
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Datacenter','datacenter',10),
  ('Self-storage','self_storage',20),
  ('Life sciences','life_sciences',30),
  ('Laboratoriumruimte','laboratorium',40),
  ('Research & development','rnd',50),
  ('Studio / media vastgoed','studio_media',60),
  ('Telecomlocatie','telecom',70),
  ('Energie-infrastructuur','energie_infra',80),
  ('Batterijopslaglocatie','batterijopslag',90),
  ('Crematorium / uitvaartvastgoed','uitvaart',100),
  ('Religieus vastgoed','religieus',110),
  ('Specialistisch zorgvastgoed','specialistisch_zorg',120),
  ('Flex living','flex_living',130),
  ('Co-living','co_living',140),
  ('Senior living','senior_living',150)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'alternatief';

-- Vastgoedportefeuille
INSERT INTO public.property_subtypes (property_type_id, name, slug, sort_order)
SELECT id, x.name, x.slug, x.sort_order FROM public.property_types pt
CROSS JOIN (VALUES
  ('Woningportefeuille','woningportefeuille_p',10),
  ('Appartementenportefeuille','appartementenportefeuille',20),
  ('Kamerverhuurportefeuille','kamerverhuurportefeuille',30),
  ('Studentenhuisvestingsportefeuille','studentenportefeuille',40),
  ('Retailportefeuille','retailportefeuille',50),
  ('Supermarktportefeuille','supermarktportefeuille',60),
  ('Kantoorportefeuille','kantoorportefeuille',70),
  ('Bedrijfsruimteportefeuille','bedrijfsruimteportefeuille',80),
  ('Logistieke portefeuille','logistieke_portefeuille_p',90),
  ('Light industrial portefeuille','light_industrial_portefeuille',100),
  ('Zorgvastgoedportefeuille','zorgvastgoedportefeuille',110),
  ('Mixed-use portefeuille','mixeduse_portefeuille',120),
  ('Regionale portefeuille','regionale_portefeuille',130),
  ('Landelijke portefeuille','landelijke_portefeuille',140),
  ('Gespreide portefeuille','gespreide_portefeuille',150),
  ('Single-city portefeuille','single_city_portefeuille',160),
  ('Uitpondportefeuille','uitpondportefeuille',170),
  ('Herontwikkelingsportefeuille','herontwikkelingsportefeuille',180),
  ('Sale-and-leaseback portefeuille','salb_portefeuille',190)
) AS x(name,slug,sort_order)
WHERE pt.slug = 'portefeuille';

-- =====================================================================
-- 6. SEED DEAL_TYPES
-- =====================================================================

INSERT INTO public.deal_types (name, slug, sort_order) VALUES
  ('Belegging','belegging',10),
  ('Verkoop','verkoop',20),
  ('Aankoop','aankoop',30),
  ('Off-market','off_market',40),
  ('Stille verkoop','stille_verkoop',50),
  ('Transformatie','transformatie',60),
  ('Herontwikkeling','herontwikkeling',70),
  ('Ontwikkellocatie','ontwikkellocatie',80),
  ('Turn-key belegging','turn_key',90),
  ('Value-add','value_add',100),
  ('Core','core',110),
  ('Core-plus','core_plus',120),
  ('Opportunistisch','opportunistisch',130),
  ('Uitponding','uitponding',140),
  ('Splitsing','splitsing',150),
  ('Sale-and-leaseback','sale_and_leaseback',160),
  ('Leegstand','leegstand',170),
  ('Verhuurd object','verhuurd',180),
  ('Gedeeltelijk verhuurd','gedeeltelijk_verhuurd',190),
  ('Eigen gebruik','eigen_gebruik',200),
  ('Portefeuille','portefeuille_dt',210),
  ('Single asset','single_asset',220),
  ('Complexgewijze verkoop','complex_verkoop',230),
  ('Grondpositie','grondpositie_dt',240),
  ('Vergund project','vergund_project',250),
  ('Onvergund project','onvergund_project',260),
  ('Tender / biedingsproces','tender',270),
  ('Bilaterale transactie','bilateraal',280),
  ('Sale via NDA','sale_nda',290),
  ('Huurverlenging / asset management kans','asset_mgmt',300);

-- =====================================================================
-- 7. ALIASES (oude waarden -> nieuwe ids)
-- =====================================================================

-- Oude AssetClass enum -> property_type
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'wonen', id FROM public.property_types WHERE slug='residentieel';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'winkels', id FROM public.property_types WHERE slug='retail';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'kantoren', id FROM public.property_types WHERE slug='kantoor';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'logistiek', id FROM public.property_types WHERE slug='logistiek';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'bedrijfshallen', id FROM public.property_types WHERE slug='bedrijfsruimte';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'industrieel', id FROM public.property_types WHERE slug='light_industrial';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'hotels', id FROM public.property_types WHERE slug='leisure';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'zorgvastgoed', id FROM public.property_types WHERE slug='zorg';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'mixed_use', id FROM public.property_types WHERE slug='mixed_use';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id)
SELECT 'ontwikkellocatie', id FROM public.property_types WHERE slug='ontwikkellocatie';

-- Tekst-aliases (bestaande labels uit object_subcategorieen)
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Residentieel', pt.id, NULL FROM public.property_types pt WHERE pt.slug='residentieel';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Woonbeleggingen', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='huurwoningen'
  WHERE pt.slug='residentieel';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Appartementen', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='appartementen'
  WHERE pt.slug='residentieel';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Kantoorruimte', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='kantoorruimte'
  WHERE pt.slug='kantoor';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Retail vastgoed', pt.id, NULL FROM public.property_types pt WHERE pt.slug='retail';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Winkel', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='winkelruimte'
  WHERE pt.slug='retail';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Woon-/winkelpand', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='woon_winkelpand'
  WHERE pt.slug='mixed_use';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Bedrijfsruimte', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='bedrijfsruimte'
  WHERE pt.slug='bedrijfsruimte';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Bedrijfscomplexen', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='bedrijfscomplex'
  WHERE pt.slug='bedrijfsruimte';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Logistiek vastgoed', pt.id, NULL FROM public.property_types pt WHERE pt.slug='logistiek';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Light industrial', pt.id, NULL FROM public.property_types pt WHERE pt.slug='light_industrial';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Zorg', pt.id, NULL FROM public.property_types pt WHERE pt.slug='zorg';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Zorgvastgoed – Intramuraal', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='intramuraal'
  WHERE pt.slug='zorg';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Zorgvastgoed – Extramuraal', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='extramuraal'
  WHERE pt.slug='zorg';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Zorgvastgoed – Kleinschalig wonen', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='kleinschalig_wonen'
  WHERE pt.slug='zorg';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Zorgvastgoed – Zorgappartementen', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='zorgappartementen'
  WHERE pt.slug='zorg';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Leisure vastgoed', pt.id, NULL FROM public.property_types pt WHERE pt.slug='leisure';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Mixed-use', pt.id, NULL FROM public.property_types pt WHERE pt.slug='mixed_use';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Transformatieobject', pt.id, NULL FROM public.property_types pt WHERE pt.slug='transformatie';
INSERT INTO public.property_type_aliases (alias, mapped_property_type_id, mapped_property_subtype_id)
SELECT 'Woning eigen gebruik', pt.id, ps.id FROM public.property_types pt
  JOIN public.property_subtypes ps ON ps.property_type_id=pt.id AND ps.slug='woning_eigen_gebruik'
  WHERE pt.slug='residentieel';

-- =====================================================================
-- 8. MIGREER BESTAANDE OBJECTEN, ZOEKPROFIELEN, RELATIES
-- =====================================================================

-- Objecten: zet property_type_id op basis van type_vastgoed
UPDATE public.objecten o
SET property_type_id = a.mapped_property_type_id
FROM public.property_type_aliases a
WHERE a.alias = o.type_vastgoed::text
  AND o.property_type_id IS NULL;

-- Zoekprofielen: vul property_type_ids op basis van type_vastgoed array
UPDATE public.zoekprofielen z
SET property_type_ids = sub.ids
FROM (
  SELECT z.id AS zid, COALESCE(array_agg(DISTINCT a.mapped_property_type_id) FILTER (WHERE a.mapped_property_type_id IS NOT NULL), '{}'::uuid[]) AS ids
  FROM public.zoekprofielen z
  LEFT JOIN LATERAL unnest(z.type_vastgoed) AS tv ON true
  LEFT JOIN public.property_type_aliases a ON a.alias = tv::text
  GROUP BY z.id
) sub
WHERE z.id = sub.zid AND array_length(z.property_type_ids,1) IS NULL;

-- Relaties: vul property_type_ids op basis van asset_classes array
UPDATE public.relaties r
SET property_type_ids = sub.ids
FROM (
  SELECT r.id AS rid, COALESCE(array_agg(DISTINCT a.mapped_property_type_id) FILTER (WHERE a.mapped_property_type_id IS NOT NULL), '{}'::uuid[]) AS ids
  FROM public.relaties r
  LEFT JOIN LATERAL unnest(r.asset_classes) AS ac ON true
  LEFT JOIN public.property_type_aliases a ON a.alias = ac::text
  GROUP BY r.id
) sub
WHERE r.id = sub.rid AND array_length(r.property_type_ids,1) IS NULL;