# CRM-MIG-2C-2 — classificatie DDL-draft

Status: **niet uitvoerbaar / niet goedgekeurd voor databasewijziging**.

## Doel

Werk de in 2C-1 bewezen delta uit tot een nieuwe, doelgerichte schema-draft voor uitsluitend het zelfstandige CRM-doelproject `vyjocdlwfxrblusfngfq`, zonder de historische migraties blind te replayen.

## Veiligheidsvorm

De SQL staat bewust onder `supabase/migration-drafts/` en niet onder `supabase/migrations/`.

Daarnaast begint de draft met een transactionele fail-closed sentinel die vóór de eerste DDL een exception veroorzaakt. De ongewijzigde draft is daarmee geen goedgekeurde uitvoeringsmigratie.

Voor een latere uitvoerings-BUILD moeten minimaal opnieuw worden bewezen:

1. targetguard groen voor exact `vyjocdlwfxrblusfngfq`;
2. 2C-1 read-only probe nog steeds dezelfde delta toont;
3. geen onverwachte schemawijziging sinds de inventarisatie;
4. review van de DDL-diff;
5. apart besluit over classificatie-seeddata;
6. expliciete toestemming voor toepassing op het doelproject.

## Scope van de draft

- vier nieuwe classificatietabellen;
- PK/FK/unique-constraints;
- RLS en bestaande intern/admin-policysemantiek;
- negen koppelingkolommen op `objecten`, `zoekprofielen` en `relaties`;
- classificatie-indexen;
- idempotente `IF NOT EXISTS` waar PostgreSQL dat veilig ondersteunt.

## Buiten scope

- seeddata / taxonomie-inhoud;
- Auth-user migratie;
- Storage;
- Edge Functions;
- Off-Market tabellen;
- Vastgoedrekenen;
- Vastgoedkansen/Productiekern;
- BAG;
- Kadaster-betaalflow;
- MCP;
- Vercel-cutover.

## Belangrijk

Deze PR mag na groene CI worden gemerged als **ontwerp/draft**. Dat is geen toestemming om de SQL op Supabase uit te voeren. Voor uitvoering wordt een aparte, expliciete BUILD/gate gebruikt waarbij de fail-closed sentinel bewust en reviewbaar moet worden verwijderd.
