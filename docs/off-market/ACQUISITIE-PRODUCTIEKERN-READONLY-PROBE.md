# PLAN A — Read-only databaseprobe

## Doel

Voor BUILD A moet de actuele productie-CRM read-only worden gecontroleerd op DDL, constraints, indexen, RLS, policies en datakwaliteit.

Beoogd project:

`ljudxyrqoifhfikueric`

## Actuele connectorstatus — 8 augustus 2026

De gekoppelde Supabase-connector is opnieuw read-only geïnventariseerd voordat enige SQL werd uitgevoerd.

De connector retourneert momenteel uitsluitend:

- `vyjocdlwfxrblusfngfq` — ouder Supabase-project;
- `xfygspvpeugxowxbcvnm` — `bito-bag-shadow`.

Het beoogde CRM-productieproject `ljudxyrqoifhfikueric` staat niet in de toegankelijke projectlijst. Daarom is bewust **geen** query tegen een alternatief project uitgevoerd: metadata uit een ander project mag niet als productie-DDL/RLS-bewijs worden gebruikt.

## Eerdere uitvoeringspoging

Er was reeds uitsluitend een read-only query voorbereid voor:

- kolommen van `off_market_acquisitie_selectie`;
- kolommen van `off_market_brieven`;
- kolommen van `off_market_brief_events`;
- relevante kolommen van `taken` en `off_market_signalen`;
- policies uit `pg_policies`;
- indexen uit `pg_indexes`.

De connector weigerde destijds de uitvoering met:

`You do not have permission to perform this action`

## Exacte herhaalbare probe

De repository bevat nu:

`scripts/acquisitie/productiekern-production-readonly-probe.sql`

Deze probe:

- start expliciet met `BEGIN TRANSACTION READ ONLY`;
- leest catalogusmetadata voor kolommen, constraints, indexen, RLS, policies en grants;
- controleert de autorisatiehelper `public.is_intern_gebruiker`;
- retourneert alleen geaggregeerde datakwaliteit voor selectie, brieven en briefevents;
- retourneert geen namen, adressen of brieftekst;
- eindigt met `ROLLBACK`;
- benoemt expliciet `ljudxyrqoifhfikueric` als enig geldig doelproject.

Uitvoering van deze probe tegen productie blijft vereist voordat `actueleDdlGeverifieerd` of `actueleRlsGeverifieerd` op `true` mag worden gezet.

## Repository-DDL bevinding

De migratiehistorie bevat voor `public.off_market_brieven` de legacy constraint:

- `off_market_brieven_status_check`;
- toegestane waarden: `concept`, `verstuurd`.

De BUILD-A-contractlaag gebruikt voor de briefidentiteit daarnaast `definitief` en `geannuleerd`, terwijl verzending op de briefversie wordt vastgelegd. Zonder compatibiliteitsaanpassing zou de transactionele functie `off_market_brief_definitief_maken` op een schema met de historische constraint falen.

Daarom is de dossier/briefkern-draft aangepast met een defensieve transitiefase:

- bestaande benoemde constraint alleen vervangen wanneer de definitie herkenbaar de legacy waarden `concept` en `verstuurd` bevat;
- onverwachte constraintdefinitie blokkeert met `onverwachte_off_market_brieven_status_constraint`;
- tijdelijke compatibele set: `concept`, `verstuurd`, `definitief`, `geannuleerd`;
- constraint blijft `NOT VALID`, zodat historische rijen niet automatisch worden teruggevuld of gevalideerd;
- legacy `verstuurd` blijft tijdens de transitie toegestaan.

Dit is uitsluitend een draft-correctie; er is niets op productie toegepast.

## Veiligheidsresultaat

- Geen productiequery is uitgevoerd.
- Geen productiedata is gelezen.
- Geen databaseobject is gewijzigd.
- Geen Supabase-configuratie is gewijzigd.
- Geen productiehandeling is uitgevoerd.
- Er is geen query tegen het oudere Supabase-project of BAG-shadow uitgevoerd om ontbrekend productiebewijs te simuleren.

## Gevolg voor PLAN A

De repository-inventarisatie is beschikbaar en de bekende legacy-statusconstraint is in het migratieconcept defensief afgevangen, maar de actuele databaseconfiguratie is nog niet bewezen. De volgende punten blijven daarom blokkerend voor database-activatie in BUILD A:

- actuele productie-DDL;
- unieke constraints en indexen;
- actuele productie-RLS-policies en grants;
- actuele datakwaliteit;
- aantallen en inconsistenties in bestaande brieven;
- veilige migratieclassificatie van historische records.

BUILD A mag voorbereidende, niet-activerende code en migratieontwerpen bevatten, maar geen productiebackfill of activatie zolang deze read-only probe niet aantoonbaar groen is.
