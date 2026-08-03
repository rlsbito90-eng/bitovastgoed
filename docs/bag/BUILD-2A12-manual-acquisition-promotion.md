# BAG BUILD 2A.12 — handmatige acquisitiepromotie

## Uitkomst

BUILD 2A.12 sluit de frontend- en acquisitieworkflow af met één expliciete
CRM-writegrens. Alleen kandidaten uit een volledig groene 2A.11-preflight kunnen
worden toegevoegd. De gebruiker moet daarna nog een afzonderlijke dialoog openen,
een bevestigingscheckbox activeren en op `Ja, handmatig toevoegen` klikken.

## Aangemaakte Vastgoedkans

Per bevestigd pand wordt uitsluitend een Vastgoedkans aangemaakt met:

- het bronadres, postcode en plaats;
- BAG-pand-ID;
- gebruiksdoelen en een korte omschrijving;
- herkomst `bag_selectie`;
- scope, datasetversie en voorkomen_sleutel in de herkomstreferentie;
- status `te_beoordelen` en prioriteit 3;
- eigenaar-, Kadaster- en briefstatus `niet_gestart`;
- reactiestatus `geen_reactie`.

Er wordt geen Object of Deal gemaakt. Er start geen eigenaar-, Kadaster-, brief-,
AI- of andere vervolgactie.

## Foutgedrag

De bestaande CRM-hook schrijft één kans per geselecteerd pand. Het resultaat houdt
per BAG-ID exact bij wat is toegevoegd en wat is mislukt. Er is geen automatische
retry. Succesvolle IDs worden uit de lokale selectie verwijderd; na ieder resultaat
vervalt de preflight, zodat een volgende write opnieuw gecontroleerd moet worden.

## Operationele status

De codeworkflow is compleet, maar blijft standaard verborgen achter de 2A.10-
featureflag. Activering vereist nog steeds een actieve BAG-dataset, groen
`active-dataset`-rapport, handmatig gatewaycredential en shadow-deployment van de
Edge Function. Geen van die operationele stappen en geen productie-Supabasewijziging
maakt deel uit van BUILD 2A.12.
