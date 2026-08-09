# CRM-MIG-2B — dependency-geordend schema-manifest

Status: migratievoorbereiding. Deze bundel voert geen DDL, DML, deploy of data-import uit.

## Doel

Vertaal de in CRM-MIG-2A bewezen schema-gap naar kleine dependency-geordende clusters. Het manifest is richtinggevend voor latere, afzonderlijk te reviewen schema-BUILDs op uitsluitend `vyjocdlwfxrblusfngfq`.

## Belangrijk uitgangspunt

De repository bevat historische migraties die naast objectcreatie ook bestaande tabellen wijzigen, seeddata invoegen, RLS/policies aanmaken en triggers/functions toevoegen. Omdat `vyjoc...` al 22 tabellen heeft maar slechts één geregistreerde Supabase-migratie, mogen deze historische bestanden niet blind worden afgespeeld.

Iedere latere schema-BUILD moet daarom:

1. de actuele doeldefinitie read-only meten;
2. alleen de noodzakelijke canonieke delta samenstellen;
3. vooraf de CRM-targetguard uitvoeren;
4. expliciet `vyjocdlwfxrblusfngfq` als doel bevestigen;
5. DDL in een kleine, afzonderlijke bundel houden;
6. na toepassing tabellen, kolommen, FK/PK, indexes, enums, RLS en policies opnieuw valideren.

## Dependencyvolgorde

### 2B-1 — Property- en dealclassificatie

`property_types`, `property_subtypes`, `deal_types`, `property_type_aliases`.

Dit cluster raakt daarnaast bestaande `objecten`, `zoekprofielen` en `relaties`. Een latere implementatie moet dus eerst kolomdrift op die drie bestaande tabellen expliciet reconciliëren.

### 2B-2 — Pipelinefundament

`pipelines`, `pipeline_stages`, `object_pipeline` plus de bijbehorende pipeline-enums/koppelingen.

### 2B-3 — CRM-uitbreidingen

Contactmomenten, objectdossier/aanbiedingsteksten/aandachtspunten, biedingen en historische Kadaster-record/documentopslag. Dit gaat uitsluitend om opgeslagen CRM-data; geen betaalde Kadaster-call wordt geactiveerd.

### 2B-4 — Vastgoedrekenen basis

Scenario's, componenten, outputs, exit assumptions, kosten, WWS, risico, sell-off units, tax settings en gebruikersvoorkeuren.

### 2B-5 — Vastgoedrekenen uitbreidingen

Kengetallenregister, verkrijgingsstructuur, comparables, financiering, taxonomie/gebiedsvoorkeuren en bronpakket/importcontracten.

### 2B-6 — Off-Market Radar

Bronnen, ruwe signalen, genormaliseerde signalen, AI-run-audit, Kadaster-checkstatus, imports, brieven/events en acquisitieselectie. Scheduler, Edge Functions en betaalde externe calls blijven buiten schema-opbouw.

### 2B-7 — Acquisitie en Vastgoedkansen

Legacy acquisitiecampagnes/targets en `vastgoedkansen` volgen pas wanneer onderliggende CRM-, pipeline- en Off-Market-contracten aantoonbaar aanwezig zijn.

## Bewust uitgesloten

- BAG private schema/objecten en `bag_service` — BAG-project blijft volledig gescheiden;
- MCP;
- Edge Function deployment;
- scheduler/cronactivatie;
- Auth-user migratie/OAuth-configuratie;
- Storage-objectcopy;
- `crm_objectregistraties` / `crm_objectbronkoppelingen` totdat de bestaande CRM-objectidentiteit apart is beoordeeld;
- Kadaster kostenbeheer (`kadaster_budgetten`, `kadaster_kosten_events`, `kadaster_producten`) totdat betaalde-productflow apart is beoordeeld.

## Eerstvolgende implementatiestap na 2B

Niet meteen alle clusters installeren. Begin met **CRM-MIG-2C-1**: maak voor uitsluitend 2B-1 een exacte read-only delta tussen het actuele repositorycontract en `vyjoc...`, inclusief de drie bestaande tabellen die door de historische migratie worden geraakt. Pas daarna kan een aparte DDL-BUILD worden voorgesteld.
