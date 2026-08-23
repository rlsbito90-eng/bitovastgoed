-- Transformatie / herontwikkeling · Post · Brief 1–3 · Variant B.
-- Controle A en challenger B staan voor iedere stap actief met gewicht 100,
-- waardoor nieuwe communicatie per brief 50/50 over A en B wordt verdeeld.

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
values
  (
    'transformatie_herontwikkeling',
    'post',
    'brief_1',
    'B',
    'Kort/direct',
    'Een brief die het transformatie- of herontwikkelingssignaal kort als aanleiding benoemt zonder het te duiden en sneller naar de commerciële opening en CTA gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de meer uitleggevende controlevariant.',
    'transformatie_herontwikkeling_post_brief_1_b_v1',
    true,
    false,
    100
  ),
  (
    'transformatie_herontwikkeling',
    'post',
    'brief_2',
    'B',
    'Compact/direct',
    'Een follow-up die het oorspronkelijke signaal niet herhaalt en direct doorgaat naar de vraag of verkoop speelt, verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons ten opzichte van de langere controle-follow-up.',
    'transformatie_herontwikkeling_post_brief_2_b_v1',
    true,
    false,
    100
  ),
  (
    'transformatie_herontwikkeling',
    'post',
    'brief_3',
    'B',
    'Compacte afsluiting',
    'Een compactere Brief 3 die minder terugblikt op het oorspronkelijke signaal en sneller naar de commerciële opening en een rustige afronding gaat, verhoogt de kwalitatieve verkopersrespons ten opzichte van de uitgebreidere controle-afsluiter.',
    'transformatie_herontwikkeling_post_brief_3_b_v1',
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

update public.acquisitie_copy_varianten
set
  actief = true,
  is_control = true,
  gewicht = 100,
  updated_at = now()
where profiel = 'transformatie_herontwikkeling'
  and kanaal = 'post'
  and campagne_stap in ('brief_1', 'brief_2', 'brief_3')
  and variant_code = 'A';
