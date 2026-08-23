-- Eerste echte copy-challenger: Splitsingspotentie · Post · Brief 1 · Variant B.
-- Controle A blijft actief met gewicht 100; B krijgt eveneens gewicht 100,
-- waardoor de actieve verdeling voor nieuwe communicatie 50/50 is.

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
  'splitsingspotentie',
  'post',
  'brief_1',
  'B',
  'Kort/direct',
  'Een kortere, object- en splitsingsgerichte eerste brief met één laagdrempelige CTA verhoogt de kwalitatieve respons ten opzichte van de algemene controlebrief.',
  'splitsingspotentie_post_brief_1_b_v1',
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

-- Performance housekeeping: de eerder toegevoegde FK was nog niet geïndexeerd.
create index if not exists off_market_brieven_copy_variant_id_idx
  on public.off_market_brieven(copy_variant_id)
  where copy_variant_id is not null;
