# BAG BUILD 2A.4A — shadow-preflight en schema-only uitvoergate

## Doel

Voorkom dat de BAG-migratiekandidaat ooit tegen een verkeerd of productieproject wordt uitgevoerd en bewijs vervolgens, zonder importdata, dat het private schema veilig kan worden aangemaakt.

## Twee afzonderlijke standen

1. **Read-only preflight** — identificeert projectref, host, database, rol, PostgreSQL, PostGIS, bestaande BAG-schema’s en productie-indicatoren.
2. **Schema-only proef** — wordt alleen bereikbaar met een tweede expliciete vlag en de exacte approval phrase `APPLY_BAG_SCHEMA_ONLY_2A4A`.

De standaardstand is altijd read-only. Het script logt de database-URL en het wachtwoord nooit.

## Fail-closed controles

- actuele projectref is exact gelijk aan de vooraf bevestigde shadowprojectref;
- omgevingslabel is exact `shadow`;
- directe of session-pooler-URL behoort aantoonbaar bij die projectref;
- TLS is expliciet verplicht;
- de bekende productieprojectref en aanvullende productie-denylijst zijn geblokkeerd;
- PostgreSQL 15+ en PostGIS in schema `extensions` zijn aanwezig;
- de drie BAG-schema’s bestaan nog niet;
- exacte CRM/Auth-rijtellingen bevatten geen productie-indicator;
- statement-, lock- en idle-in-transaction-time-outs zijn begrensd.

## Schema-only acceptatie

Na uitvoering moeten exact aanwezig zijn:

- drie private BAG-schema’s;
- tien lege BAG-tabellen;
- geforceerde RLS op alle tien tabellen;
- drie veilige `NOLOGIN`/`NOINHERIT`/`NOBYPASSRLS`-rollen;
- nul BAG-schemarechten voor `anon`, `authenticated` en `service_role`;
- nul geïmporteerde BAG-rijen.

## Gebruik

Read-only preflight:

```bash
BAG_SHADOW_PROJECT_REF='<shadow-ref>' \
BAG_EXPECTED_SHADOW_PROJECT_REF='<shadow-ref>' \
BAG_SHADOW_ENVIRONMENT='shadow' \
BAG_SHADOW_DATABASE_URL='<ssl-database-url>' \
bash scripts/bag/run-2a4a-shadow-preflight.sh
```

Schema-only is pas toegestaan na afzonderlijke bevestiging van het doelproject en een volledig groen preflightrapport. Er wordt in BUILD 2A.4A geen BAG-data geladen en niets in `public`, CRM, Auth, Storage of Edge Functions gewijzigd.
