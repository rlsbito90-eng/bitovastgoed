update public.acquisitie_copy_varianten
set
  naam = 'Netwerkgericht/profielspecifiek',
  hypothese = 'Een profielspecifieke eerste brief die de concrete vastgoedpotentie koppelt aan relevante vraag uit het netwerk, zonder brede opsomming van andere strategieën, verhoogt de kwalitatieve verkopersrespons.',
  template_key = 'splitsing_post_brief_1_a_v1',
  updated_at = now()
where profiel = 'splitsingspotentie'
  and kanaal = 'post'
  and campagne_stap = 'brief_1'
  and variant_code = 'A';

update public.acquisitie_copy_varianten
set
  naam = 'Netwerkgericht/profielspecifiek',
  hypothese = 'Een eerste brief die de concrete woonvormingsvergunning koppelt aan vraag naar aanvullende zelfstandige woonruimte en de verkoopvraag voorzichtig positioneert, verhoogt de kwalitatieve verkopersrespons.',
  template_key = 'woonvorming_post_brief_1_a_v1',
  updated_at = now()
where profiel = 'woonvorming'
  and kanaal = 'post'
  and campagne_stap = 'brief_1'
  and variant_code = 'A';
