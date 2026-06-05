UPDATE public.off_market_bronnen
SET config = jsonb_set(
  config,
  '{negatieve_keywords}',
  to_jsonb(ARRAY[
    'dakkapel','schuur','aanbouw','uitbouw','serre','kapvergunning','inrit',
    'terras','evenementenvergunning','reclamevergunning',
    'kozijn','kozijnen','gevelherstel','gevelrenovatie','gevelreiniging',
    'isolatie','na-isolatie','schilderwerk','schilderen','onderhoud',
    'groot onderhoud','achterstallig onderhoud','verduurzaming','verduurzamen',
    'winkelpui','puivernieuwing','pui vernieuwen','voegwerk','voegen',
    'dakbedekking','dakrenovatie','dakwerk','zonnepanelen','warmtepomp'
  ])
)
WHERE type = 'bekendmaking';