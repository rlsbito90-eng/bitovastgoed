-- Activeer de inhoudelijk goedgekeurde B-varianten voor
-- Kamerverhuur / verhuur- & exploitatieoptimalisatie · Post · Brief 1–3.
-- Controle A bestaat al vanuit de generieke seed en blijft gewicht 100.

insert into public.acquisitie_copy_varianten (
  profiel, kanaal, campagne_stap, variant_code, naam, hypothese,
  template_key, actief, is_control, gewicht
)
values
  (
    'kamerverhuur_verhuur_exploitatieoptimalisatie', 'post', 'brief_1', 'B',
    'Kort/direct',
    'Een kortere eerste brief die het omzettings- of kamerverhuursignaal feitelijk benoemt en sneller naar de verkoopvraag gaat, verhoogt de kwalitatieve verkopersrespons.',
    'kamerverhuur_post_brief_1_b_v1', true, false, 100
  ),
  (
    'kamerverhuur_verhuur_exploitatieoptimalisatie', 'post', 'brief_2', 'B',
    'Compact/direct',
    'Een korte follow-up die alleen naar het eerdere contact verwijst en de vergunning niet opnieuw uitlegt, verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.',
    'kamerverhuur_post_brief_2_b_v1', true, false, 100
  ),
  (
    'kamerverhuur_verhuur_exploitatieoptimalisatie', 'post', 'brief_3', 'B',
    'Compacte afsluiting',
    'Een korte, rustige laatste follow-up verhoogt de kans op reactie zonder de eigenaar onnodig onder druk te zetten.',
    'kamerverhuur_post_brief_3_b_v1', true, false, 100
  )
on conflict (profiel, kanaal, campagne_stap, variant_code)
do update set
  naam = excluded.naam,
  hypothese = excluded.hypothese,
  template_key = excluded.template_key,
  actief = excluded.actief,
  is_control = excluded.is_control,
  gewicht = excluded.gewicht,
  updated_at = now();
