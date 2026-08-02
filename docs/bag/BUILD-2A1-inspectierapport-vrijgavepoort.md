# BUILD 2A.1 — Inspectierapport en vrijgavepoort

## Doel

Deze stap vertaalt het artifact van de handmatige GitHub Actions-broninspectie naar een formeel, testbaar vrijgavebesluit.

De echte BAG Extract-adapter mag pas worden gebouwd wanneer het rapport aantoonbaar voldoet aan alle bron- en volledigheidsvoorwaarden.

## Vereiste bronbestanden

Het inspectierapport moet minimaal bevatten:

1. de officiële BAG Extract-XSD-set;
2. het officiële gemeenteproefbestand van Assen, gemeentecode 0106.

Per bronbestand worden vastgelegd:

- officiële HTTPS-bron;
- bestandsnaam;
- bestandsgrootte;
- SHA-256-checksum;
- ZIP-integriteit;
- volledige inhoudsinventarisatie;
- aantal XSD- en XML-bestanden.

## Vrijgavevoorwaarden

De mapping wordt uitsluitend vrijgegeven wanneer:

- beide officiële bronbestanden zijn geïnspecteerd;
- beide ZIP-bestanden leesbaar zijn;
- beide bestanden een geldige SHA-256-checksum hebben;
- ten minste één XSD- en één XML-bestand zijn aangetroffen;
- namespaces uit de werkelijke bestanden zijn geïnventariseerd;
- de proef-XML aantoonbaar tegen de officiële XSD-set valideert;
- het proefbestand aantoonbaar gemeente Assen (0106) bevat;
- alle zeven BAG-objecttypen zijn aangetroffen;
- de inspectieworkflow geen fouten rapporteert.

## Zeven objecttypen

- pand;
- verblijfsobject;
- nummeraanduiding;
- openbare ruimte;
- woonplaats;
- standplaats;
- ligplaats.

## Determinisme

Het rapport wordt vóór validatie genormaliseerd:

- checksums naar lowercase;
- bestanden en namespaces uniek en gesorteerd;
- objecttypen uniek en gesorteerd;
- bronbestanden op naam gesorteerd;
- foutmeldingen uniek en gesorteerd.

Hierdoor levert dezelfde inspectie-inhoud onafhankelijk van volgorde dezelfde fingerprint op.

## Buiten scope

Deze stap:

- downloadt zelf geen bestanden;
- verwerkt nog geen officiële BAG XML;
- schrijft niet naar Supabase;
- publiceert geen datasetversie;
- wijzigt geen CRM-records;
- implementeert nog geen GML- of historievertaling.

## Volgende stap

Na een groen inspectierapport worden op basis van de echte XSD- en XML-inhoud de volgende contracten vastgelegd:

1. exacte namespaces;
2. bestandsrollen en naamconventies;
3. object- en voorkomenpaden;
4. relatiepaden;
5. historie- en geldigheidsvelden;
6. GML-geometrietype en CRS;
7. selectie van actuele versus historische voorkomens.
