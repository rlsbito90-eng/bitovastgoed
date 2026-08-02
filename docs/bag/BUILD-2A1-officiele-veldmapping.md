# BUILD 2A.1 — Officiële BAG-veldmapping

## Doel

Dit document legt de XML-paden vast die rechtstreeks zijn bevestigd aan de hand van het officiële BAG Extract-proefbestand voor Assen (gemeentecode 0106) en de officiële XSD-set.

De mapping is nog geen productie-importer. Zij vormt het contract voor de volgende adapterstap.

## Recordstructuur

Een geleverd BAG-record heeft als directe omhulling:

```text
bagObject
├── heeftAlsHoofdadres / heeftAlsNevenadres (waar van toepassing)
├── voorkomen
└── object
    └── Pand | Verblijfsobject | Nummeraanduiding | ...
```

Voorkomenmetadata wordt daarom niet in het object zelf gezocht, maar afzonderlijk onder `voorkomen/Voorkomen`.

## Bevestigde namespaces

- Extractdeelbestand: `http://www.kadaster.nl/schemas/lvbag/extract-deelbestand-lvc/v20200601`
- IMBAG-objecten: `www.kadaster.nl/schemas/lvbag/imbag/objecten/v20200601`
- IMBAG-typen: `www.kadaster.nl/schemas/lvbag/imbag/typen/v20200601`
- GML: `http://www.opengis.net/gml/3.2`

## Bevestigde objectvelden

### Pand

- identificatie;
- geometrie als GML Polygon met `posList`;
- oorspronkelijk bouwjaar;
- status;
- geconstateerd;
- documentdatum en documentnummer.

De officiële fixture bevat RD-coördinaten met drie ordinaten per punt, waarbij de derde waarde `0.0` kan zijn.

### Verblijfsobject

- identificatie;
- geometrie als GML Point met `pos`;
- een of meer gebruiksdoelen;
- oppervlakte;
- status;
- `PandRef` onder `maaktDeelUitVan`;
- hoofd- en eventueel nevenadres als `NummeraanduidingRef` buiten het objectelement.

### Nummeraanduiding

- identificatie;
- huisnummer, huisletter en huisnummertoevoeging;
- postcode;
- type adresseerbaar object;
- status;
- `OpenbareRuimteRef` onder `ligtAan`.

### Openbare ruimte

- identificatie;
- naam;
- type;
- status;
- `WoonplaatsRef` onder `ligtIn`.

### Woonplaats

- identificatie;
- naam;
- status;
- GML MultiSurface/Polygon-geometrie.

### Standplaats en ligplaats

- identificatie;
- status;
- GML Polygon-geometrie;
- hoofd- en eventueel nevenadres via `NummeraanduidingRef`.

## Voorkomen en historie

Bevestigde velden zijn onder meer:

- voorkomenidentificatie;
- beginGeldigheid en optioneel eindGeldigheid;
- tijdstipRegistratie en optioneel eindRegistratie;
- tijdstipRegistratieLV en optioneel tijdstipEindRegistratieLV;
- tijdstipInactief en tijdstipInactiefLV voor inactieve voorkomens.

De importlaag moet een BAG-object en zijn voorkomen afzonderlijk modelleren. Een objectidentificatie alleen is niet voldoende als unieke sleutel voor historie.

## Geometrie

De officiële fixtures bevestigen:

- Pand: polygoon, 3D-coordinate tuples mogelijk;
- VBO: punt, 3D-coordinate tuple mogelijk;
- standplaats en ligplaats: polygoon, 2D-coordinate tuples;
- woonplaats: MultiSurface met polygonen;
- nummeraanduiding en openbare ruimte: geen eigen geometrie in de fixture.

De bron gebruikt Rijksdriehoekscoördinaten. Transformatie naar WGS84 of Web Mercator hoort niet in de XML-parser, maar in een afzonderlijke ruimtelijke laad- of querylaag.

## Grenzen

De mapping is gebaseerd op representatieve officiële fixtures. Variaties die niet in het Assen-proefbestand voorkomen, zoals afzonderlijke objectrecords in de categorie `in onderzoek`, blijven expliciet onbevestigd.

De volgende adapterstap moet:

1. namespace-onafhankelijk op lokale elementnamen kunnen lezen;
2. voorkomenmetadata en objectinhoud samenvoegen tot één bronrecord;
3. herhaalde relaties en gebruiksdoelen ondersteunen;
4. 2D- en 3D-GML valideren;
5. onbekende elementen niet stil verwerpen;
6. geen database- of CRM-schrijfacties uitvoeren.
