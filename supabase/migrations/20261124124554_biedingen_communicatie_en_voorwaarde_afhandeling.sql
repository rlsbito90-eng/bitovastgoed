alter table public.biedingen
  add column originele_communicatie text,
  add column voorbehoud_details jsonb check (voorbehoud_details is null or jsonb_typeof(voorbehoud_details) = 'object'),
  add column afhandeling_voorwaarden jsonb check (afhandeling_voorwaarden is null or jsonb_typeof(afhandeling_voorwaarden) = 'object');
comment on column public.biedingen.afhandeling_voorwaarden is 'Expliciet geregistreerde afhandeling per voorwaarde van het geaccepteerde bod; los van taakstatus.';
notify pgrst, 'reload schema';
