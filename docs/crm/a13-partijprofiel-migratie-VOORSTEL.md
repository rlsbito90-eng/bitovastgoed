# A13 — Migratievoorstel, NOG NIET UITGEVOERD

Doel: beschrijvende classificatie en strategieën opslaan zonder het bestaande `type_partij` (ENUM), `investeerder_subtype`, `commercial_roles` of `zoekprofielen` te wijzigen.

Geen backfill en geen automatisch aannemen dat een belegger ook koper is.

## Voorgestelde SQL (alleen na aparte productie-autorisatie)
Maak een officiële Supabase-migratie aan met `supabase migration new add_partijprofiel_strategie_a13`, na controle van het **juiste** project-ID en herstelveiligheid. Plaats dan deze SQL in die migratie:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '25s';

ALTER TABLE public.relaties
  ADD COLUMN partijprofiel text NULL,
  ADD COLUMN vastgoed_strategieen text[] NULL;

ALTER TABLE public.relaties
  ADD CONSTRAINT relaties_partijprofiel_allowed
    CHECK (partijprofiel IS NULL OR partijprofiel IN (
      'belegger','ontwikkelende_belegger','ontwikkelaar',
      'vastgoedondernemer','makelaar','bemiddelaar','vastgoedeigenaar','overig'
    )),
  ADD CONSTRAINT relaties_vastgoed_strategieen_allowed
    CHECK (vastgoed_strategieen IS NULL OR (
      vastgoed_strategieen <@ ARRAY[
        'langetermijnbelegging','value_add','transformatie',
        'uitponden','projectontwikkeling','handel'
      ]::text[]
      AND array_position(vastgoed_strategieen, NULL) IS NULL
    ));
COMMIT;
```

## Gates en rollback
- SQL is alleen een ontwerp in `docs`, GEEN uitvoerbare migratie en niet automatisch naar Supabase uitgerold.
- Controleer eerst de actuele database-identiteit en het verschil tussen `supabase/config.toml` en productie.
- Check Row Level Security, bestaande constraints, de actuele kopie en mogelijkheid tot herstellen.
- Eerst additive database-migratie en postchecks, pas daarna productiecode.
- Rollback van de app: vorige GitHub/Vercel-release herstellen, nieuwe nullable kolommen behouden.
- Kolommen verwijderen is data-destructief na gebruik; alleen na export en apart akkoord.
