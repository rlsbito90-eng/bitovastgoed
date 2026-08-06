# PLAN A — Read-only databaseprobe

## Doel

Voor BUILD A moet de actuele productie-CRM read-only worden gecontroleerd op DDL, constraints, indexen, RLS, policies en datakwaliteit.

Beoogd project:

`ljudxyrqoifhfikueric`

## Uitgevoerde poging

Er is uitsluitend een read-only query voorbereid voor:

- kolommen van `off_market_acquisitie_selectie`;
- kolommen van `off_market_brieven`;
- kolommen van `off_market_brief_events`;
- relevante kolommen van `taken` en `off_market_signalen`;
- policies uit `pg_policies`;
- indexen uit `pg_indexes`.

De connector heeft de uitvoering geweigerd met:

`You do not have permission to perform this action`

## Veiligheidsresultaat

- Geen query is uitgevoerd.
- Geen data is gelezen.
- Geen databaseobject is gewijzigd.
- Geen Supabase-configuratie is gewijzigd.
- Geen productiehandeling is uitgevoerd.

## Gevolg voor PLAN A

De repository-inventarisatie is beschikbaar, maar de actuele databaseconfiguratie is nog niet bewezen. De volgende punten blijven daarom blokkerend voor database-activatie in BUILD A:

- actuele DDL;
- unieke constraints en indexen;
- RLS-policies en grants;
- actuele datakwaliteit;
- aantallen en inconsistenties in bestaande brieven;
- veilige migratieclassificatie van historische records.

BUILD A mag voorbereidende, niet-activerende code en migratieontwerpen bevatten, maar geen productiebackfill of activatie zolang deze read-only probe niet aantoonbaar groen is.