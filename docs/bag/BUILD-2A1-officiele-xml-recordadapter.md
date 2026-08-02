# BUILD 2A.1 — Officiële BAG XML-recordadapter

## Doel

Deze stap vertaalt één volledig officieel BAG Extract-record naar een intern adapterrecord en, waar van toepassing, naar het bestaande `BagBronRecord`-contract.

De adapter schrijft niet naar een database en voert geen CRM-promotie uit.

## Ondersteunde BAG-objecttypen

- Pand
- Verblijfsobject
- Nummeraanduiding
- OpenbareRuimte
- Woonplaats
- Standplaats
- Ligplaats

## Uitvoer

Per record worden vastgelegd:

- objecttype;
- identificatie;
- status;
- voorkomenidentificatie;
- geldigheids- en registratietijdstippen;
- eventuele inactiviteitsvelden;
- RD-geometrie met vorm, dimensie en coördinaatwaarden;
- relaties naar andere BAG-objecten;
- objectspecifieke velden.

## Parserbrug

Voor de drie objecttypen die de bestaande parserproef ondersteunt, wordt tevens een `BagBronRecord` opgebouwd:

- Pand;
- Verblijfsobject;
- Nummeraanduiding.

Openbare ruimte en woonplaats blijven voorlopig afzonderlijke adapterrecords. De latere relationele normalisatielaag gebruikt deze records om straat- en woonplaatsnamen aan nummeraanduidingen te koppelen.

## Geometrie

De adapter behoudt de broncoördinaten als `EPSG:28992`.

Ondersteund:

- `gml:pos` voor punten;
- `gml:posList` voor polygonen;
- 2D- en 3D-coördinaten.

Er vindt in deze stap geen conversie naar WGS84, GeoJSON of WKT plaats.

## Validatie

De adapter rapporteert expliciet:

- onbekend objecttype;
- ontbrekende identificatie;
- geometrie waarvan het aantal waarden niet past bij de dimensie.

## Begrenzingen

Deze implementatie verwerkt één compleet XML-record als string. Streaming selectie van records uit een volledig extract blijft de verantwoordelijkheid van de extractreader.

De adapter gebruikt lokale XML-elementnamen en is daarmee prefix-onafhankelijk. De bron moet wel afkomstig zijn uit het vooraf gevalideerde officiële BAG Extract-contract.

## Vervolg

De eerstvolgende stap is een relationele normalisatielaag die:

1. openbare ruimten aan woonplaatsen koppelt;
2. nummeraanduidingen verrijkt met straat- en woonplaatsnaam;
3. hoofd- en nevenadressen afzonderlijk bewaart;
4. actuele voorkomens selecteert zonder historie te verwijderen;
5. de volledige officiële adapterrecords doorgeeft aan de latere staging-import.
