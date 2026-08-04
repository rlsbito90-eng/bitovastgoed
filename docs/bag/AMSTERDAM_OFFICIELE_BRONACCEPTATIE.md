# Amsterdam officiële BAG-bronacceptatie

## Doel

Deze run accepteert uitsluitend een officieel BAG-bronpakket voor Amsterdam, scope `0363`, voordat enige shadowimport wordt toegestaan.

## Benodigde GitHub environment-secrets

In environment `bag-shadow`:

- `BAG_AMSTERDAM_SOURCE_URL`: tijdelijke officiële download-URL uit Mijn Kadaster of de leveringsmail;
- `BAG_AMSTERDAM_SOURCE_SHA256`: vooraf onafhankelijk berekende SHA-256 van exact hetzelfde ZIP-bestand.

De URL wordt bewust niet als workflow-input gebruikt, omdat workflow-inputs en runmetadata zichtbaar kunnen blijven.

## Handmatige start

Workflow: **BAG Amsterdam officiële bronacceptatie**

Exacte bevestiging:

`VALIDATE_BAG_AMSTERDAM_SOURCE_0363`

## Wat de run doet

1. controleert dat URL en checksum aanwezig zijn;
2. downloadt het bronpakket;
3. verifieert SHA-256 en ZIP-integriteit;
4. pakt geneste ZIP-bestanden padveilig uit;
5. extraheert officiële BAG-standrecords naar tijdelijk NDJSON;
6. controleert dat identificatieprefix `0363` minimaal 90% van de geïdentificeerde records vormt;
7. publiceert alleen compacte tellingen en validatierapporten.

## Wat de run niet doet

- geen verbinding met Supabase;
- geen insert, update, delete, truncate of DDL;
- geen activering van Amsterdam;
- geen wijziging aan de Edge Function of allowlists;
- geen benadering van productieproject `ljudxyrqoifhfikueric`;
- het bron-ZIP en `records.ndjson` worden niet als artifact bewaard.

## Vervolgpoort

Pas na een groene bronacceptatie worden de werkelijke tellingen gebruikt voor:

- capaciteitsbesluit;
- tranchegrootte;
- import-runmanifest;
- gecontroleerde shadowimport;
- integriteitsvalidatie;
- afzonderlijke publicatie en scope-activatie.
