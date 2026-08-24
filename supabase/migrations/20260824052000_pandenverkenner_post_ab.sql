alter table public.off_market_brieven
  add column if not exists geadresseerde_label text,
  add column if not exists adresseerwijze text;

alter table public.off_market_brieven
  drop constraint if exists off_market_brieven_adresseerwijze_check;

alter table public.off_market_brieven
  add constraint off_market_brieven_adresseerwijze_check
  check (adresseerwijze is null or adresseerwijze in ('eigenaar_bekend', 'eigenaar_objectadres'));

insert into public.acquisitie_copy_varianten
  (profiel, kanaal, campagne_stap, variant_code, naam, hypothese, template_key, actief, is_control, gewicht)
values
  ('pandenverkenner_woon_winkelpand','post','brief_1','A','Netwerk/context','Een iets meer onderbouwde eerste brief die de selectie uitlegt vanuit concrete marktvraag in het netwerk verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_woon_winkelpand_brief_1_a_v1',true,true,100),
  ('pandenverkenner_woon_winkelpand','post','brief_1','B','Kort/direct','Een kortere eerste brief die sneller van objectinteresse naar de verkoopvraag gaat verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_woon_winkelpand_brief_1_b_v1',true,false,100),
  ('pandenverkenner_gemengd_vastgoed','post','brief_1','A','Netwerk/context','Een iets meer onderbouwde eerste brief die de selectie uitlegt vanuit concrete marktvraag in het netwerk verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_gemengd_vastgoed_brief_1_a_v1',true,true,100),
  ('pandenverkenner_gemengd_vastgoed','post','brief_1','B','Kort/direct','Een kortere eerste brief die sneller van objectinteresse naar de verkoopvraag gaat verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_gemengd_vastgoed_brief_1_b_v1',true,false,100),
  ('pandenverkenner_woonvastgoed','post','brief_1','A','Netwerk/context','Een iets meer onderbouwde eerste brief die de selectie uitlegt vanuit concrete marktvraag in het netwerk verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_woonvastgoed_brief_1_a_v1',true,true,100),
  ('pandenverkenner_woonvastgoed','post','brief_1','B','Kort/direct','Een kortere eerste brief die sneller van objectinteresse naar de verkoopvraag gaat verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_woonvastgoed_brief_1_b_v1',true,false,100),
  ('pandenverkenner_commercieel_vastgoed','post','brief_1','A','Netwerk/context','Een iets meer onderbouwde eerste brief die de selectie uitlegt vanuit concrete marktvraag in het netwerk verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_commercieel_vastgoed_brief_1_a_v1',true,true,100),
  ('pandenverkenner_commercieel_vastgoed','post','brief_1','B','Kort/direct','Een kortere eerste brief die sneller van objectinteresse naar de verkoopvraag gaat verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_commercieel_vastgoed_brief_1_b_v1',true,false,100),
  ('pandenverkenner_algemene_acquisitie','post','brief_1','A','Netwerk/context','Een iets meer onderbouwde eerste brief die de selectie uitlegt vanuit concrete marktvraag in het netwerk verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_algemene_acquisitie_brief_1_a_v1',true,true,100),
  ('pandenverkenner_algemene_acquisitie','post','brief_1','B','Kort/direct','Een kortere eerste brief die sneller van objectinteresse naar de verkoopvraag gaat verlaagt de leesdrempel en verhoogt de kwalitatieve verkopersrespons.','pandenverkenner_algemene_acquisitie_brief_1_b_v1',true,false,100)
on conflict (profiel, kanaal, campagne_stap, variant_code) do update set
  naam = excluded.naam,
  hypothese = excluded.hypothese,
  template_key = excluded.template_key,
  actief = excluded.actief,
  is_control = excluded.is_control,
  gewicht = excluded.gewicht;
