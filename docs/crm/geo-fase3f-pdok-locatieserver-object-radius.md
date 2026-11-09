# CRM fase 3F — gecontroleerde PDOK-locatieverificatie voor zoekradius

## Doel
Object- en radiuslocaties via officiële PDOK Locatieserver v3.1 als geverifieerde
coördinaten vastleggen, zodat R2 **uitsluitend** bij voldoende locatiebewijs
afstandsclaims mag doen. Verkeerde BAG-adressen of impliciete reistijdschattingen
mogen geen deal-matches uitsluiten.

## Bestaande situatie (9 november 2026)
- 43 actieve objecten, 26 met adres en plaats, 15 ook met postcode.
- Geen enkel object had vóór deze wijziging geverifieerde geo-coördinaten.
- Vier bekende radiusrelaties: Amersfoort (35 km), Utrecht (25 km),
  Bergen op Zoom (25 km), Ede (60 minuten reistijd).

## Nieuwe werking
1. **Objectdetail → Locatie → BAG-adres controleren.** Zoeken start pas na
   bewuste klik. Off-marketadressen worden dus niet automatisch naar PDOK verstuurd.
   Gebruiker selecteert expliciet één BAG-resultaat. Controleren: BAG-nummeraanduiding,
   postcode indien bekend, woonplaats, en bij eenvoudig adres straat/huisnummer.
   Voor een complex met meerdere adressen is het bevestigde punt een
   **representatief referentieadres**, niet de gehele portefeuille.
2. **Relatiedetail → Investering en financiering → Centrumplaats controleren.**
   Bij een ingevulde radius kiest gebruiker expliciet de PDOK-woonplaats die
   overeenkomt met het ingevoerde zoekcentrum. Het officiële woonplaatscentrum
   is geen persoonlijk vertrekadres; bij reistijd blijft een routeplanner nodig.
3. Bevestigde locaties bewaren WGS84 latitude/longitude, PDOK-resultaat-ID,
   leesbare bronvermelding en verificatiemoment.
4. **Database triggers** verwijderen objectcoördinaten zodra adres, postcode of
   plaats wijzigt. Voor relaties worden centrumcoördinaten ongeldig bij wijziging
   van de centrumplaats. Harde CHECK-constraints accepteren geen halve/bronloze
   geoverificaties.
5. R2 rekent hemelsbrede afstanden pas bij beide geverifieerde PDOK-bronnen.
   Ontbrekende data blijft **te verifiëren**; reistijd wordt niet als kilometerafkap
   toegepast.

## Niet automatisch
- Geen massale PDOK-lookups of bulk-mutatie van bestaande objecten.
- Niet automatisch postcodes, BAG-id's of adressen in CRM overschrijven.
- Geen routeplanner/reistijden, geen geografische berekening vanuit een lege
  provincie of afgeschermde locatie.
- Geen geocodering bij typen: alleen met expliciete gebruikersactie.

## Gegevens/privacy
De browser verstuurt het ingevulde adres of de centrumplaats rechtstreeks naar
de publieke PDOK Locatieserver, uitsluitend wanneer de gebruiker op Zoeken klikt.
Een off-market objectadres kan vertrouwelijk zijn. Laat de gebruiker de
zoekactie bewust starten en bevestig één resultaat. Alle CRM-mutaties worden
via de bestaande, door RLS beveiligde interne Supabase-sessie uitgevoerd.

## Techniek
- Hergebruik bestaande `src/lib/bag/pdokLookup.ts`, uitgebreid met officiële
  `centroide_ll` en woonplaatszoekactie (`type:woonplaats`).
- `src/components/geo/PdokLocatieVerifier.tsx` is herbruikbaar voor Object/Relatie.
- Migratie `20261109083601_pdok_verificatie_object_en_radius_herkomst.sql`.
- In `objectToDb` en `relatieToDb` zijn geo-velden aangevuld.
- R2 vereist bronprefix `PDOK-BAG:` en `PDOK-WOONPLAATS:`.
- Pure tests voor WKT-lon/lat, PDOK filters, BAG-nummeraanduiding, adresmatch,
  matchkwalificatie en veilige invalidering van oude coördinaten.
- DB-transactietest (ROLLBACK) bevestigt dat adres- en centrumwijziging
  oude geoverificatie automatisch verwijdert.

## Uitrol en acceptatie
Na groene TypeScript, regressietests en productiebuild kan de UI worden gepubliceerd.
Het eerste echte PDOK-adres en het woonplaatscentrum moeten daarna nog door
een interne CRM-gebruiker handmatig gekozen worden. Er worden dus bij
productiepublicatie **niet spontaan** tientallen locaties als geverifieerd gelabeld.
