# BUILD 2A.1 — Deterministische BAG-parserproef

## Doel

Deze stap bewijst de normalisatie- en relatiekern voor een toekomstige volledige BAG-import zonder netwerk, Supabase, productiegegevens of XML-afhankelijkheid.

De parserproef gebruikt vaste in-memory fixtures als contract voor de latere streamende BAG Extract-parser.

## In scope

- panden normaliseren;
- verblijfsobjecten normaliseren;
- nummeraanduidingen naar volledige adressen normaliseren;
- pand–VBO-relaties reconstrueren;
- VBO–nummeraanduidingrelaties reconstrueren;
- postcode en tekstvelden normaliseren;
- duplicaten expliciet afwijzen;
- ongeldige bronwaarden expliciet afwijzen;
- ontbrekende relaties expliciet registreren;
- checkpointinformatie opleveren;
- deterministische fingerprints genereren voor idempotentiecontrole.

## Buiten scope

- echte BAG XML lezen;
- ZIP-bestanden uitpakken;
- bestanden downloaden;
- database- of Supabasewrites;
- PostGIS;
- publicatie van een datasetversie;
- kaartweergave;
- CRM-promotie;
- eigenaar- of Kadasteronderzoek.

## Contract

### Geldige bronobjecten

De proef onderscheidt:

1. `pand`;
2. `verblijfsobject`;
3. `nummeraanduiding`.

De latere XML-adapter moet ieder BAG XML-element eerst naar één van deze broncontracten vertalen. De normalisatiekern blijft daardoor onafhankelijk van XML-namespaces en Kadaster-bestandsverdeling.

### Relaties

Een verblijfsobject kan aan één of meer panden en één of meer nummeraanduidingen zijn gekoppeld. Relaties worden pas na het verwerken van alle bronregels gevalideerd. Daardoor is de volgorde van objecttypen in een bronbestand niet bepalend.

### Afwijzingen

Iedere afwijzing bevat:

- recordtype;
- identificatie, indien aanwezig;
- machineleesbare code;
- menselijke reden.

Stille uitval is niet toegestaan.

Ondersteunde codes in deze proef:

- `ontbrekende_identificatie`;
- `ongeldig_bouwjaar`;
- `ongeldige_oppervlakte`;
- `ontbrekend_pand`;
- `ontbrekende_nummeraanduiding`;
- `onvolledig_adres`;
- `duplicaat_record`.

### Determinisme

Alle resultaatcollecties worden op stabiele sleutels gesorteerd. Bij identieke invoer moet de fingerprint exact gelijk zijn. Dit vormt de basis voor de latere idempotentiecontrole van twee opeenvolgende importproeven.

### Checkpoint

De proef legt vast:

- hoeveel bronregels vanaf de startindex zijn verwerkt;
- de index van de laatste verwerkte bronregel.

Dit is nog geen bestandscursor. De latere streamende parser moet dit uitbreiden met bronbestand, entrynaam, byte- of elementoffset en objecttellingen.

## Acceptatiecriteria

- geldige fixture levert sluitende object- en relatietellingen;
- postcode en adres worden deterministisch genormaliseerd;
- functiedoelen worden ontdubbeld en stabiel gesorteerd;
- ontbrekende relaties leiden tot afwijzingen, niet tot stille verwijdering van het VBO;
- duplicaten worden niet overschreven;
- alle afwijzingen bevatten een reden;
- twee runs met dezelfde invoer leveren dezelfde fingerprint;
- geen module importeert Supabase-, netwerk- of CRM-code.

## Volgende stap

De volgende stap is een XML-adapterproef met een klein, vast BAG-achtig XML-fixturebestand. Die adapter moet streamend elementen uitlezen en uitsluitend de hier gedefinieerde bronrecords aan de normalisatiekern aanbieden.
