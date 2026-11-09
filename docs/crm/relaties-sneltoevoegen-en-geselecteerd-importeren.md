# Relaties — algemene snelinvoer en geselecteerde import (fase 4A)

## Doel
Een nieuwe relatie registreren moet vanaf het overzicht **Relaties** met minimale handelingen mogelijk zijn, ongeacht herkomst (telefoon, WhatsApp, LinkedIn, e-mail, netwerk of andere route).

## Snel toevoegen
- Primaire knop **Snel toevoegen** opent compacte relatie-invoer; het bestaande uitgebreide formulier blijft met **Uitgebreid toevoegen** beschikbaar.
- Invoer: naam, bedrijf, e-mail, telefoon, optioneel persoonlijk LinkedIn-profiel, partijtype. Alle behalve minimaal één identificerend veld zijn optioneel.
- Standaard `leadStatus='actief'`; het echte partijtype kies je bewust, geen veronderstelling dat elke contactpersoon een koper is.
- Slaat de profiel-URL zowel op de relatie als, bij opgegeven naam, op de primaire contactpersoon.
- **Opslaan en volgende** slaat de vorige relatie op en maakt het formulier leeg zonder sluiten. Normaal opslaan leidt naar de nieuwe relatiekaart.
- Blokkeer bekende dubbelen op exacte e-mail, vergelijkbare telefooncijfers, hetzelfde LinkedIn-profiel en exact naam+bedrijf, ook als de gegevens op een contactpersoon van een bestaande relatie staan.
- Onbekende/niet-bestaande LinkedIn-adressen mogen niet als geldig persoonlijk LinkedIn-profiel worden opgeslagen; invullen is optioneel.

## Meerdere toevoegen
- Behoud bestaande CSV- of Excel-tabelplakfunctie.
- Importeer ook het uitgepakte LinkedIn-`Connections.csv`: herkent `First Name`, `Last Name`, `URL`, `Email Address`, `Company`, `Position`, `Connected On`, eventueel met begeleidende Notes-regels vóór de kolomnamen.
- Maak van een LinkedIn-connectie **niet** automatisch een gekwalificeerde vastgoedbelegger. `type='overig'` en `leadStatus='actief'`; de functie en connectiedatum worden als bronnotities opgeslagen.
- LinkedIn-import **standaard zonder geselecteerde rijen**; importeer alleen bewust geselecteerde connecties.
- Detecteer dubbelen binnen het bestand en ten opzichte van CRM Relaties en contactpersonen. Dubbelen/fouten zijn in de importpreview niet selecteerbaar.
- Direct vóór verzenden opnieuw de bestaande e-mailadressen, telefoonnummers, profiel-URL's en namen uit Supabase laden voor een extra check bij een verouderde voorvertoning.
- Na toevoegen ook primaire contactpersoon bewaren; bij mogelijke deelproblemen de gebruiker expliciet waarschuwen **niet opnieuw te importeren**, omdat Relatie reeds kan bestaan.

## Beperkingen
- Het systeem downloadt geen LinkedIn-gegevens rechtstreeks en gebruikt geen scraping. De gebruiker exporteert zelf officiële data, verwijdert irrelevante contacten en selecteert wie in Bito CRM wordt vastgelegd.
- Van veel LinkedIn-connecties is geen e-mailadres beschikbaar; ontbreken ervan betekent geen fout.
- Vrije naamovereenkomsten zonder bedrijf, telefoon, mail of URL blijven lastig automatisch te dedupliceren.
- Een dynamische batchimport in de browser is geen databasebrede unieke constraint; gelijktijdige invoer via andere cliënten kan in theorie dubbele relaties maken. Dit vraagt eventueel later om een serverzijdige idempotente import-RPC.
- De primaire-contactpersoonaanmaak na bulkrelaties is niet atomair; bij fouten wordt dat expliciet gemeld. Dit kan in een vervolgstap met transactionele backendfunctie worden verbeterd.

## Vrijgave
Alleen na typecheck, regressietests, productiebuild, Vercel-previewcontrole en databasecontrole. Testdata wordt nooit als echte contactpersoon in productie aangemaakt.
