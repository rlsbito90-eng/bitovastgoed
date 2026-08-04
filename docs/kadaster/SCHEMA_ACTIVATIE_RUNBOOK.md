# Kadaster/objectidentiteit — gecontroleerde schema-activatie

## Doel

Activeer de centrale objectidentiteit en app-brede Kadasterkostenlaag alleen na een expliciete, gecontroleerde databasehandeling. Deze BUILD past niets toe op Supabase.

## Betrokken migraties

1. `20260804150000_crm_objectidentiteit.sql`
2. `20260804152000_kadaster_kostenbeheer.sql`

De volgorde is verplicht omdat kosten-events naar `crm_objectregistraties` verwijzen.

## Voorwaarden vóór activatie

- productieproject ondubbelzinnig geïdentificeerd;
- recente databaseback-up of herstelmogelijkheid bevestigd;
- migraties vooraf op een geïsoleerde omgeving gevalideerd;
- geen Kadaster-API-key nodig of aanwezig;
- geen betaalde producten actief;
- beheerder begrijpt dat deze stap uitsluitend schema en lege productconfiguratie toevoegt;
- expliciete goedkeuring voor de gekozen Supabase-omgeving.

## Fail-closed activatievolgorde

1. Controleer dat de werkboom en `main` schoon/actueel zijn.
2. Voer beide migraties eerst op een niet-productieomgeving uit.
3. Voer `supabase/verification/kadaster_schema_preflight.sql` read-only uit.
4. Accepteer uitsluitend status `schema_ready`.
5. Genereer daarna Supabase TypeScript-types vanuit die gevalideerde omgeving.
6. Vergelijk gegenereerde types met `src/lib/kadaster/databaseContract.ts`.
7. Pas pas na afzonderlijke productiegoedkeuring dezelfde migraties op productie toe.
8. Voer de preflight opnieuw uit en controleer dat alle producten inactief zijn.

## Harde veiligheidsgrenzen

- geen automatische migratie vanuit de browser;
- geen browser-writepolicy op `kadaster_kosten_events`;
- geen betaalde productactivatie tijdens schema-activatie;
- geen Kadastergateway, API-call of secret in deze stap;
- geen backfill of automatische koppeling van bestaande CRM-records zonder afzonderlijke diagnose;
- een foutstatus uit de preflight blokkeert verdere uitvoering.

## Verwachte lege beginsituatie

- vijf nieuwe tabellen aanwezig;
- RLS actief op alle vijf;
- productcatalogus aanwezig, alle producten `actief = false`;
- nul kosten-events;
- nul objectregistraties en bronkoppelingen totdat een aparte backfill-BUILD is goedgekeurd;
- rapportagepagina toont nulwaarden in plaats van fictieve kosten.

## Previewvalidatie

Na wijziging van de Vercel-accountcapaciteit moet een nieuwe commit een volledig nieuwe previewbuild starten; een oude rate-limitstatus geldt niet als inhoudelijke codevalidatie.
