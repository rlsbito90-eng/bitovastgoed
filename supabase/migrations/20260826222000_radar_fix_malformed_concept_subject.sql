-- Herstel uitsluitend het bekende legacy-format in actieve CONCEPTEN.
-- Verstuurde/geprinte historische brieven blijven immutable.
-- Nieuwe templates normaliseren de objectomschrijving al in de applicatie.

update public.off_market_brieven
   set onderwerp = regexp_replace(
         onderwerp,
         '^Interesse in uw pand aan +(aan|voor) +',
         'Interesse in uw pand aan ',
         'i'
       )
 where archived_at is null
   and status = 'concept'
   and onderwerp ~* '^Interesse in uw pand aan +(aan|voor) +';
