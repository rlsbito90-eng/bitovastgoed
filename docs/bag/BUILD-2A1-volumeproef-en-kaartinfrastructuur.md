# BUILD 2A.1 — BAG-volumeproef en kaartinfrastructuurdiagnose

## Status

PLAN / technische proefopzet. Deze fase wijzigt geen productiegegevens, bestaande CRM-tabellen of Kadasterprocessen.

## Doel

Bepalen hoe een volledige, versiebeheerste en doorzoekbare BAG-bronlaag voor heel Nederland veilig kan worden geïmporteerd, opgeslagen, geografisch ontsloten en op kaart getoond zonder de operationele CRM-database onnodig te belasten.

## Vaste architectuurprincipes

1. BAG-brondata blijft gescheiden van Objecten, Vastgoedkansen, Deals en Off-Market-signalen.
2. Een BAG-pand wordt nooit automatisch een commercieel CRM-object.
3. Kadaster-eigenaaronderzoek blijft handmatig.
4. Imports zijn idempotent, hervatbaar, meetbaar en rollbackbaar.
5. De actieve BAG-versie wordt atomair gepubliceerd; gebruikers zien nooit een half geïmporteerde dataset.
6. Kaart- en zoekquery’s lezen uit een afgeleide pandindex, niet rechtstreeks uit ruwe importtabellen.
7. Gemeente-, wijk- en buurttoewijzing is versiegebonden en herberekenbaar.
8. De eerste proef gebruikt een beperkte gemeente of representatieve subset en nooit direct het volledige landelijke extract in productie.

## Onderzoeksvragen

### Volume

- Hoe groot zijn bronbestand, uitgepakte XML en geometrieën?
- Hoeveel records ontstaan per BAG-objecttype?
- Wat is de opslagomvang vóór en na indexering?
- Hoeveel opslag gebruikt de afgeleide pandzoekindex?
- Hoeveel adressen, VBO’s en pandrelaties heeft een gemiddeld en zwaar pand?

### Import

- Welke XML-bestanden en namespaces bevat het actuele BAG Extract?
- Kan de import streamend worden uitgevoerd zonder het volledige bestand in geheugen te laden?
- Welke batchgrootte geeft stabiele doorvoer?
- Hoe worden fouten per bronrecord vastgelegd en hervat?
- Welke controles bewijzen dat relaties en aantallen compleet zijn?

### Databaseplaatsing

Vergelijk minimaal:

- afzonderlijk `bag`-schema in de bestaande Supabase-database;
- afzonderlijk Supabase-project of PostgreSQL-database voor de BAG-bronlaag.

Beoordeel per optie importbelasting, querylatency, opslag- en back-upimpact, isolatie van CRM-workloads, beheercomplexiteit, kosten en koppeling met CRM-preflight.

### PostGIS en kaart

- Is PostGIS beschikbaar en bruikbaar in de gekozen proefomgeving?
- Welke SRID wordt intern gebruikt voor opslag en welke voor webkaarten?
- Welke geometrie wordt bewaard: volledig pandvlak, representatief punt of beide?
- Welke GIST-indexen zijn nodig voor viewport-, buurt- en polygonselecties?
- Bij welk zoomniveau gebruiken we clusters, punten of pandcontouren?
- Is GeoJSON voldoende voor de eerste gemeenteproef en wanneer zijn vectortiles noodzakelijk?

## Beoogde proefarchitectuur

```text
BAG Extract / beperkte proeflevering
        ↓
streamende parser
        ↓
bag_staging.*
        ↓
validatie en controlegetallen
        ↓
bag_source.* versiegebonden bronobjecten
        ↓
bag_search.pand_index
        ↓
zoek-API / kaart-viewportquery
        ↓
Pandenverkenner lijst + kaart
```

## Minimale proefobjecten

De proef verwerkt minimaal pand, verblijfsobject, nummeraanduiding, openbare ruimte, woonplaats, pand–verblijfsobjectrelatie en verblijfsobject–nummeraanduidingrelatie.

Standplaatsen en ligplaatsen worden in het model gereserveerd, maar mogen buiten de eerste meetrun blijven wanneer dit expliciet wordt vastgelegd.

## Conceptuele schemascheiding

### `bag_admin`

Datasetversies, import-runs, bronbestanden, controlegetallen, importfouten en publicatie-/rollbackstatus.

### `bag_staging`

Tijdelijke, versiegebonden importrecords. Niet rechtstreeks toegankelijk voor de frontend.

### `bag_source`

Genormaliseerde BAG-bronobjecten en relaties per datasetversie.

### `bag_geo`

Gemeenten, wijken, buurten en hun datasetversies.

### `bag_search`

Afgeleide, snelle pandindex voor zoeken, tellen, filteren en kaartquery’s.

### `public` / CRM

Alleen lichte verwijzingen naar BAG-identificaties en handmatig gepromoveerde commerciële records. Geen kopie van de volledige BAG-populatie.

## Meetplan

Per proefrun registreren:

- bronversie en peildatum;
- gemeente/subset;
- bestandsgrootte gecomprimeerd en uitgepakt;
- start- en eindtijd;
- piekgeheugen;
- records gelezen, geaccepteerd, afgewezen en overgeslagen;
- rijen per objecttype;
- ontbrekende relaties;
- opslag per schema/tabel/index;
- tijd voor opbouw pandindex;
- tijd voor buurt-/wijktoewijzing;
- querylatency p50/p95 voor lijst, telling en viewport;
- grootte van GeoJSON-responses per zoomniveau;
- fout- en hervatbaarheidstest.

## Acceptatiecriteria BUILD 2A.1

1. De proef draait zonder productietabellen te wijzigen.
2. De dataset kan na onderbreking hervatten zonder duplicaten.
3. Dezelfde bron opnieuw verwerken levert dezelfde functionele uitkomst.
4. Controlegetallen sluiten per objecttype en relatiecategorie.
5. Eén gemeente kan volledig worden bevraagd op gemeente, wijk, buurt, straat, bouwjaar en gebruiksdoel.
6. Kaartquery’s leveren uitsluitend objecten binnen de zichtbare viewport.
7. Op hoog zoomniveau kunnen pandcontouren worden geleverd; op lager zoomniveau punten of aggregaties.
8. De proef levert voldoende volume- en latencygegevens voor een definitief infrastructuurbesluit.
9. Er is een expliciet GO/NO-GO voor landelijke import in de bestaande Supabase-database.
10. Geen enkel BAG-record wordt automatisch naar Vastgoedkans, Object of Deal gepromoveerd.

## Kaartcontract voor latere BUILD 2D

De kaartlaag ondersteunt viewportquery op bounding box, gemeente-/wijk-/buurtfilter, pandpunten en pandpolygonen, clustering bij lage zoom, detaildata bij aanklikken, selectie via punt/rechthoek/polygoon/zichtbaar gebied, synchronisatie met lijstselectie, CRM-bekendheidsstatus en blijvende selectiestatus via een verkenning.

De frontend bevat reeds MapLibre- en React Map GL-afhankelijkheden. BUILD 2A.1 gebruikt die nog niet functioneel; eerst wordt de datalaag gemeten en vastgelegd.

## Buiten scope

- volledige landelijke productie-import;
- automatische eigenaarverrijking;
- Kadasterbestellingen;
- briefcampagnes;
- AI-selectie;
- wijziging van bestaande Objecten, Deals, Vastgoedkansen of Off-Market-data;
- definitieve kaart-UX;
- mutatieabonnementen of dagelijkse synchronisatie.

## Eerstvolgende uitvoerstappen

1. bestaande migratie- en testsystematiek inventariseren;
2. PostGIS-beschikbaarheid en huidige geografische conventies vaststellen;
3. keuze maken voor een representatieve proefgemeente/subset;
4. parser- en meetcontract definiëren;
5. geïsoleerde proefschema’s en import-runcontract ontwerpen;
6. pas daarna een kleine uitvoerbare importproef bouwen.
