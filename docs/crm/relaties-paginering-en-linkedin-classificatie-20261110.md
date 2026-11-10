# Relaties — paginering en zorgvuldige classificatie na LinkedIn-import

## Probleem
Na de geselecteerde LinkedIn-import stonden 736 actieve Relaties in één lange lijst.
De gebruiker wil direct navigeren tussen pagina's. Bovendien was een conservatieve
importinstelling ook toegepast op helder herkenbare makelaars, ontwikkelaars en beleggers.

## Paginering
- Standaard **25 relaties per pagina**, zowel op desktop als mobiel.
- Filters op naam, leadstatus, partijprofiel en bestaande sorteeropties worden
  op de **volledige** set toegepast; daarna wordt alleen de zichtbare pagina
  gerenderd. Geen zoekresultaten verloren op andere pagina's.
- Navigatie boven en onder de lijst; vorige/volgende, eerste/laatste pagina,
  maximaal vijf paginanummers, totaalresultaat en bereik.
- Bij wijzigingen in zoeken/filter/sortering terug naar pagina 1.
- Paginanummer in bestaande sessie-viewstate opgeslagen zodat terugkeren vanaf
  een relatiekaart niet steeds naar het begin springt.
- Een ongeldige of na filters te hoge pagina wordt veilig begrensd.
- De bestaande relatie-detailnavigatie bewaart bewust de volledige gefilterde/
  gesorteerde lijst voor volgend/vorig contact, ongeacht de zichtbare pagina.

## Inhoudelijke classificatie — 10 november 2026
Van de 609 nieuwe relatiekaarten uit de zorgvuldig door de gebruiker geselecteerde
LinkedIn-export waren aanvankelijk alle partijtypen `overig`.

Zonder commerciële rol of aankoopcriteria te verzinnen zijn 79 expliciet
herkenbare categorieën gecorrigeerd:
- 40 makelaars: 25 op eenduidige LinkedIn-functietitels, 15 op expliciete
  bedrijfsomschrijving (`makelaar`/`makelaardij`).
- 21 ontwikkelaars: 14 op eenduidige functietitels, 7 op expliciete
  bedrijfsomschrijving (`projectontwikkeling`, `vastgoedontwikkeling`,
  `real estate development`).
- 18 vastgoedbeleggers: uitsluitend expliciete beleggingsfuncties.
- De overige 530 importrelaties staan nog op `overig`; we hebben bijvoorbeeld
  niet beweerd dat elke asset manager, directeur of adviseur een vastgoedkoper is.

Bij de 79 staat een herleidbare toelichting in `notities` dat dit een
**voorlopige partijclassificatie op basis van de LinkedIn-export** is.
`commercial_roles`, investeringsbudget, rendementseisen, zoekgebied en
`lead_status='actief'` zijn onveranderd. Bestaande 127 oudere relaties zijn
niet gewijzigd.

## Testen
- Unit-tests voor pagina-aantallen, eerste/laatste/lege pagina,
  begrenzing na filtering en dynamische nummers.
- Bestaande sessie-viewstate-tests aangepast en terugwerkende compatibiliteit
  voor v1/v2 zonder paginanummer bevestigd.
- CI moet typecheck, tests en productiebuild volledig groen tonen.
- Visuele controle in ingelogde CRM-browser op desktop/mobiel apart uitvoeren.
