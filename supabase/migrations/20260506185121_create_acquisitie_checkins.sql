
CREATE TABLE IF NOT EXISTS acquisitie_checkins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  datum date NOT NULL UNIQUE,
  ochtend_calls integer,
  ochtend_mails integer,
  ochtend_linkedin integer,
  avond_calls integer,
  avond_mails integer,
  avond_linkedin integer,
  reflectie text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE acquisitie_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON acquisitie_checkins FOR ALL USING (true) WITH CHECK (true);
