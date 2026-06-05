
-- 1. dedupe_hash kolom op off_market_signalen
ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS dedupe_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_off_market_signalen_dedupe
  ON public.off_market_signalen(dedupe_hash)
  WHERE gearchiveerd_op IS NULL AND dedupe_hash IS NOT NULL;

-- 2. Seed 8 bronnen voor gemeentelijke bekendmakingen (idempotent op naam)
INSERT INTO public.off_market_bronnen (naam, type, actief, endpoint_url, config)
VALUES
  ('Bekendmakingen Amsterdam', 'bekendmaking', true,
   'https://repository.overheid.nl/sru',
   jsonb_build_object(
     'sru_creator', 'gemeente Amsterdam',
     'sru_subjects', jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),
     'max_records_per_run', 200,
     'lookback_days_first_run', 7,
     'lookback_days_default', 3,
     'score_drempel', 40,
     'positieve_keywords', jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),
     'negatieve_keywords', jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),
     'gemeente', 'Amsterdam',
     'provincie', 'Noord-Holland'
   )),
  ('Bekendmakingen Rotterdam', 'bekendmaking', true,
   'https://repository.overheid.nl/sru',
   jsonb_build_object(
     'sru_creator', 'gemeente Rotterdam',
     'sru_subjects', jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),
     'max_records_per_run', 200,
     'lookback_days_first_run', 7,
     'lookback_days_default', 3,
     'score_drempel', 40,
     'positieve_keywords', jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),
     'negatieve_keywords', jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),
     'gemeente', 'Rotterdam',
     'provincie', 'Zuid-Holland'
   )),
  ('Bekendmakingen Utrecht', 'bekendmaking', true,
   'https://repository.overheid.nl/sru',
   jsonb_build_object(
     'sru_creator', 'gemeente Utrecht',
     'sru_subjects', jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),
     'max_records_per_run', 200,
     'lookback_days_first_run', 7,
     'lookback_days_default', 3,
     'score_drempel', 40,
     'positieve_keywords', jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),
     'negatieve_keywords', jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),
     'gemeente', 'Utrecht',
     'provincie', 'Utrecht'
   )),
  ('Bekendmakingen Den Haag', 'bekendmaking', false,
   'https://repository.overheid.nl/sru',
   jsonb_build_object('sru_creator','gemeente ''s-Gravenhage','sru_subjects',jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),'max_records_per_run',200,'lookback_days_first_run',7,'lookback_days_default',3,'score_drempel',40,'positieve_keywords',jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),'negatieve_keywords',jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),'gemeente','Den Haag','provincie','Zuid-Holland')),
  ('Bekendmakingen Den Bosch', 'bekendmaking', false,
   'https://repository.overheid.nl/sru',
   jsonb_build_object('sru_creator','gemeente ''s-Hertogenbosch','sru_subjects',jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),'max_records_per_run',200,'lookback_days_first_run',7,'lookback_days_default',3,'score_drempel',40,'positieve_keywords',jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),'negatieve_keywords',jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),'gemeente','''s-Hertogenbosch','provincie','Noord-Brabant')),
  ('Bekendmakingen Tilburg', 'bekendmaking', false,
   'https://repository.overheid.nl/sru',
   jsonb_build_object('sru_creator','gemeente Tilburg','sru_subjects',jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),'max_records_per_run',200,'lookback_days_first_run',7,'lookback_days_default',3,'score_drempel',40,'positieve_keywords',jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),'negatieve_keywords',jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),'gemeente','Tilburg','provincie','Noord-Brabant')),
  ('Bekendmakingen Breda', 'bekendmaking', false,
   'https://repository.overheid.nl/sru',
   jsonb_build_object('sru_creator','gemeente Breda','sru_subjects',jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),'max_records_per_run',200,'lookback_days_first_run',7,'lookback_days_default',3,'score_drempel',40,'positieve_keywords',jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),'negatieve_keywords',jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),'gemeente','Breda','provincie','Noord-Brabant')),
  ('Bekendmakingen Eindhoven', 'bekendmaking', false,
   'https://repository.overheid.nl/sru',
   jsonb_build_object('sru_creator','gemeente Eindhoven','sru_subjects',jsonb_build_array('omgevingsvergunning','bestemmingsplan','kennisgeving','transformatie'),'max_records_per_run',200,'lookback_days_first_run',7,'lookback_days_default',3,'score_drempel',40,'positieve_keywords',jsonb_build_array('transformatie','functiewijziging','wijzigen gebruik','kamerverhuur','studentenhuisvesting','kantoor naar wonen','winkel naar wonen','sloop','nieuwbouw','herontwikkeling'),'negatieve_keywords',jsonb_build_array('dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit','terras','evenementenvergunning','reclamevergunning'),'gemeente','Eindhoven','provincie','Noord-Brabant'))
ON CONFLICT DO NOTHING;
