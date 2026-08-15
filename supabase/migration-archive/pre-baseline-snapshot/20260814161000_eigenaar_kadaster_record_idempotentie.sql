-- BUILD 2.0B — harde idempotentie voor Eigenaarsregister binnen Vastgoedkansen.
-- Eenzelfde Kadaster-record mag binnen één Vastgoedkans maar één eigenaar-koppeling opleveren.
-- Dit voorkomt race/StrictMode-dubbelen bij natuurlijke personen zonder KvK/adres.

create unique index if not exists eigenaar_koppelingen_vastgoedkans_kadaster_record_unique
  on public.eigenaar_koppelingen (vastgoedkans_id, kadaster_record_id)
  where vastgoedkans_id is not null
    and kadaster_record_id is not null;
