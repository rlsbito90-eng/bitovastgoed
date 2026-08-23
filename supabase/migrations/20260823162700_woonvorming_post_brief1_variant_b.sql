-- Woonvorming · Post · Brief 1 · Variant B.
-- Controle A blijft actief met gewicht 100; B krijgt eveneens gewicht 100,
-- waardoor de actieve verdeling voor nieuwe Brief 1-communicatie 50/50 is.

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
  'brief_1',
  'B',
  'Kort/direct',
  'Een kortere, objectgerichte eerste brief die de woonvormingscontext slechts als aanleiding benoemt en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de meer uitleggevende controlevariant.',
  'woonvorming_post_brief_1_b_v1',
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
