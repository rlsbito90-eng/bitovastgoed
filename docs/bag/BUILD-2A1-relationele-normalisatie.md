# BUILD 2A.1 — Relationele normalisatie

## Doel

Deze laag verwerkt de records uit de officiële BAG XML-recordadapter tot een actuele, relationeel navigeerbare weergave zonder historie te verwijderen.

## Verantwoordelijkheden

- groepeer voorkomens per objecttype en BAG-identificatie;
- selecteer deterministisch het actuele voorkomen;
- behoud alle overige voorkomens als historie;
- rapporteer meerdere actuele voorkomens als datakwaliteitsfout;
- los Nummeraanduiding → Openbare ruimte → Woonplaats op;
- stel adresregel en genormaliseerde postcode samen;
- houd hoofdadres en nevenadressen afzonderlijk;
- behoud VBO → Pand-relaties;
- rapporteer ontbrekende referenties zonder bronobjecten te verwijderen.

## Selectie actueel voorkomen

Een voorkomen geldt als actueel wanneer geen van deze waarden is gevuld:

- `eindGeldigheid`;
- `eindRegistratie`;
- `tijdstipInactief`.

Wanneer meer dan één voorkomen actueel lijkt, wordt het voorkomen met de nieuwste `beginGeldigheid`, daarna het nieuwste registratietijdstip en daarna het hoogste voorkomen-ID geselecteerd. De ambiguïteit blijft als fout zichtbaar.

## Adresketen

```text
Adresseerbaar object
  → hoofdadres / nevenadres
Nummeraanduiding
  → ligtAan
Openbare ruimte
  → ligtIn
Woonplaats
```

De laag voegt geen eigenaarsinformatie, Kadaster Rechten-data of CRM-status toe.

## Veiligheidsgrenzen

- geen databasewrites;
- geen Supabase-aanroep;
- geen productie- of CRM-mutatie;
- geen automatische promotie naar Vastgoedkans, Object of Deal;
- ontbrekende relaties worden expliciet gerapporteerd;
- historie wordt niet overschreven of verwijderd.

## Vervolg

De volgende stap is een stagingmodel voor objecten, voorkomens, relaties en geometrieën, gevolgd door een lokale importproef met de officiële Assen-fixtures. Een productiemigratie valt buiten BUILD 2A.1.
