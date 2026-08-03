# BAG BUILD 2A.10 — lijst- en filterinterface

## Uitkomst

BUILD 2A.10 voegt een service-backed Pandenverkennerlijst toe zonder kaart en
zonder opslagactie. De bestaande gemeentelijke PDOK-route blijft ongewijzigd
beschikbaar; de nieuwe private datasetroute verschijnt alleen na de expliciete,
niet-geheime featureflag `VITE_BAG_QUERY_SERVICE_ENABLED=true`.

## Gedrag

- de browser gebruikt uitsluitend `queryTransport.ts` en daarmee de
  geauthenticeerde Edge Function uit 2A.9;
- de eerste en iedere volgende keysetpagina bevat maximaal 100 panden;
- niets wordt automatisch geladen bij openen van de pagina;
- lokale filters werken alleen op reeds geladen pagina's;
- zoeken omvat adres, plaats, postcode, BAG-ID en gebruiksdoelen;
- functie-, gemengd-gebruik- en sorteerfilters zijn combineerbaar;
- bronvelden worden defensief genormaliseerd naar een expliciet UI-model;
- ontbrekende velden vallen terug op BAG-identificatie en worden niet verzonnen;
- de UI bevat geen kaart, directe fetch naar BAG/PDOK, databaseclient of
  service-role;
- de lijst bevat nog geen selectie- of CRM-promotieactie.

## Activering

Naast de featureflag moet `VITE_BAG_QUERY_SCOPE_CODE` naar een werkelijk actieve,
door 2A.8 goedgekeurde scope wijzen. Zolang Edge-deployment, credential en actieve
dataset ontbreken, blijft de flag uit. Daardoor verandert BUILD 2A.10 het huidige
productiegedrag niet.

BUILD 2A.11 kan bovenop dit expliciete lijstmodel selectie en CRM-deduplicatie
toevoegen; BUILD 2A.12 blijft verantwoordelijk voor uitsluitend handmatige
promotie.
