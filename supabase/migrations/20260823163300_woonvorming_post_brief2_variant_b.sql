-- Woonvorming · Post · Brief 2 · Variant B.
-- Controle A blijft actief met gewicht 100; B krijgt eveneens gewicht 100,
-- waardoor nieuwe Brief 2-communicatie 50/50 over A en B wordt verdeeld.

insert into public.acquisitie_copy_varianten (
  profiel,
  kanaal,
  campagne_stap,
  variant_code,
  naam,
  hypothese,
  template_key,
  actief,
  is_control,
  gewicht
)
values (
  'woonvorming',
  'post',
  'brief_2',
  'B',
  'Compact/direct',
  'Een compactere follow-up die het eerdere contact kort benoemt, de woonvormingscontext niet opnieuw uitlegt en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-follow-up.',
  'woonvorming_post_brief_2_b_v1',
  true,
  false,
  100
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
