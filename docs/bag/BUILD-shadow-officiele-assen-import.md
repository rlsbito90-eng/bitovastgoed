# BAG — officiële Assen-import op het afgescheiden shadowproject

Deze handmatige workflow laadt het officiële Kadaster-proefbestand voor gemeente
Assen (scope `0106`) in het bevestigde, afgescheiden BAG-shadowproject. Productie,
CRM-tabellen en frontend-featureflags vallen expliciet buiten de workflow.

## Veiligheidsgrenzen

- Alleen projectref `xfygspvpeugxowxbcvnm` wordt geaccepteerd.
- Productieref `ljudxyrqoifhfikueric` wordt zowel als projectref als in de database-URL geweigerd.
- De database-URL moet `sslmode=require` bevatten.
- De import start uitsluitend met approval phrase `APPLY_BAG_OFFICIAL_ASSEN_SHADOW`.
- De BAG-tabellen moeten vooraf leeg zijn.
- De vier CSV-tellingen moeten exact aansluiten op het gevalideerde manifest.
- Laden, valideren, publiceren en databaseactivatie gebeuren in één transactie.
- Tijdelijke, door `postgres` zelf verleende `SET TRUE`-memberships worden vóór de
  commit verwijderd; de drie oorspronkelijke `supabase_admin`-memberships blijven
  exact als `SET FALSE` bestaan.
- `bag_gateway` houdt geen wachtwoord en de frontend blijft uitgeschakeld.

## Eenmalige inrichting

Maak in GitHub bij **Settings → Environments** de omgeving `bag-shadow`. Voeg daar
het environment secret `BAG_SHADOW_DATABASE_URL` toe met de Session pooler-URI van
uitsluitend het shadowproject. Plaats de URI nooit in een issue, commit, workflowinput
of chatbericht.

## Handmatige uitvoering

Start de workflow **BAG shadow officiële Assen-import** via **Actions → Run workflow**
en vul exact `APPLY_BAG_OFFICIAL_ASSEN_SHADOW` in. De workflow downloadt de officiële
bron opnieuw, controleert de vaste SHA-256, voert beide bestaande integrale tests uit,
maakt de CSV-export en start pas daarna de transactionele database-import.

De workflow publiceert alleen compacte rapporten. XML-, NDJSON- en CSV-brondata en de
database-URL worden niet als artifact opgeslagen.
