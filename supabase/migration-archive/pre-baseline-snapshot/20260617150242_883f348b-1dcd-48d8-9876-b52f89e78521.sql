
-- P0 Off-Market Radar: veilige whitelist-backfill voor vervuilde plaatsvelden + assettype-default 'wonen'.
-- Geen wijziging aan adres of titel; geen regex-update; alleen evidente gevallen.

UPDATE public.off_market_signalen
SET plaats = 'Amsterdam'
WHERE plaats IN (
  'Amsterdam Aanvraag',
  'Amsterdam Vergunning',
  'Amsterdam Het',
  'Amsterdam Splitsingsvergunning',
  'Amsterdam Omzetting',
  'Amsterdam Intrekkingsbesluit',
  'Amsterdam Aanvraag Onttrekkingsvergunning',
  'Amsterdam Ontrekkingsvergunning',
  'Amsterdam Besluit',
  'AMSTERDAM Aanvraag',
  'AMSTERDAM',
  'amsterdam'
);

UPDATE public.off_market_signalen
SET plaats = 'Rotterdam'
WHERE plaats IN (
  'Rotterdam Aanvraag', 'Rotterdam Vergunning', 'Rotterdam Het',
  'Rotterdam Splitsingsvergunning', 'Rotterdam Omzetting', 'Rotterdam Besluit',
  'ROTTERDAM Aanvraag', 'ROTTERDAM', 'rotterdam'
);

UPDATE public.off_market_signalen
SET plaats = 'Den Haag'
WHERE plaats IN (
  'Den Haag Aanvraag', 'Den Haag Vergunning', 'Den Haag Het',
  'Den Haag Splitsingsvergunning', 'Den Haag Omzetting', 'Den Haag Besluit',
  'DEN HAAG Aanvraag', 'DEN HAAG', 'den haag'
);

UPDATE public.off_market_signalen
SET plaats = 'Utrecht'
WHERE plaats IN (
  'Utrecht Aanvraag', 'Utrecht Vergunning', 'Utrecht Het',
  'Utrecht Splitsingsvergunning', 'Utrecht Omzetting', 'Utrecht Besluit',
  'UTRECHT Aanvraag', 'UTRECHT', 'utrecht'
);

UPDATE public.off_market_signalen
SET plaats = 'Eindhoven'
WHERE plaats IN (
  'Eindhoven Aanvraag', 'Eindhoven Vergunning', 'Eindhoven Het',
  'Eindhoven Splitsingsvergunning', 'Eindhoven Omzetting', 'Eindhoven Besluit',
  'EINDHOVEN Aanvraag', 'EINDHOVEN', 'eindhoven'
);

UPDATE public.off_market_signalen
SET plaats = '''s-Hertogenbosch'
WHERE plaats IN (
  '''s-hertogenbosch', 'S-HERTOGENBOSCH', 's-hertogenbosch'
);

-- Losse vervuilingstermen als plaats: leegmaken zodat UI geen vervuilende plaats meer toont.
UPDATE public.off_market_signalen
SET plaats = NULL
WHERE plaats IN ('Aanvraag', 'Vergunning', 'Besluit', 'Bekendmaking', 'Melding', 'Het');

-- Assettype-default: alleen automatisch geïmporteerde 'overig'-signalen met duidelijke woonkeyword in titel.
UPDATE public.off_market_signalen
SET assettype = 'wonen'
WHERE assettype = 'overig'
  AND bron_type <> 'handmatig'
  AND (
    titel ILIKE '%splitsingsvergunning%'
    OR titel ILIKE '%woonvorming%'
    OR titel ILIKE '%omzettingsvergunning%'
    OR titel ILIKE '%appartementsrecht%'
    OR titel ILIKE '%woningvorm%'
    OR titel ILIKE '%kamerverhuur%'
    OR titel ILIKE '%kamergewijze verhuur%'
    OR titel ILIKE '%woningdelen%'
  );
