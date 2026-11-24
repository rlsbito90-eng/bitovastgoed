alter table public.biedingen add column extra_voorwaarden jsonb check (extra_voorwaarden is null or jsonb_typeof(extra_voorwaarden) = 'array');
comment on column public.biedingen.extra_voorwaarden is 'NULL = onbekend, [] = expliciet geen aanvullende gestructureerde voorwaarden; array = vastgelegde voorwaarden. Historische vrije tekst blijft apart.';
notify pgrst, 'reload schema';
