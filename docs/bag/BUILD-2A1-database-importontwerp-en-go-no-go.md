# BUILD 2A.1-L / 2A.2 — Database-importontwerp en go/no-go

## Status

De geïsoleerde databaseproef met officiële Assen-data is geslaagd. Er is geen migratie uitgevoerd en er is geen BAG-data naar Supabase, productie of CRM geschreven.

## Doel

Dit document beschrijft het database-importontwerp en legt de uitkomsten vast van BUILD 2A.2: een tijdelijke PostgreSQL 16/PostGIS 3.4-proef met officiële Assen-XML via de bestaande adapter- en stagingketen.

## Architectuurbesluit

De BAG-laag gebruikt twee strikt gescheiden zones:

1. **Staging** — volledige import van één datasetversie, inclusief historie, relaties, geometrieën en datakwaliteitsmeldingen.
2. **Published** — alleen gevalideerde datasetversies die door kaart-, zoek- en selectiediensten mogen worden gelezen.

Publicatie vindt niet plaats door bestaande rijen in-place te overschrijven. Een nieuwe datasetversie wordt eerst volledig geladen en gevalideerd. Daarna wordt de actieve datasetreferentie atomisch omgeschakeld. De vorige actieve versie blijft beschikbaar voor rollback.

## Tabelstructuur

### Datasetbeheer

- `bag_datasetversies`
  - datasetversie, scope, bronchecksum, importstatus, actief-vlag en auditmomenten;
  - maximaal één actieve versie per scope;
  - vormt de grens voor publicatie en rollback.

### Staging

- `bag_staging_objecten`
- `bag_staging_voorkomens`
- `bag_staging_relaties`
- `bag_staging_geometrieen`
- `bag_geometrie_afwijkingen`

### Published

- `bag_objecten`
- `bag_voorkomens`
- `bag_relaties`
- `bag_geometrieen`

De published-laag bevat geen CRM-objecten en mag geen Object, Deal, Vastgoedkans, eigenaar of acquisitiesignaal aanmaken of wijzigen.

## Sleutelstrategie

### Object

```text
datasetversie_id + objecttype + identificatie
```

### Voorkomen

De officiële Assen-bron bewees dat `voorkomenidentificatie` binnen één BAG-object niet altijd uniek is. Eén officiële groep kwam dubbel voor. Daarom wordt naast de bron-ID een deterministische technische sleutel gebruikt:

```text
datasetversie_id + objecttype + identificatie + voorkomen_sleutel
```

De `voorkomen_sleutel` wordt afgeleid uit:

```text
voorkomenidentificatie
+ begin_geldigheid
+ eind_geldigheid
+ tijdstip_registratie
+ eind_registratie
+ tijdstip_inactief
```

De oorspronkelijke `voorkomenidentificatie` blijft afzonderlijk bewaard en geïndexeerd.

### Relatie

```text
datasetversie_id + bron_objecttype + bron_identificatie + relatietype + doel_identificatie
```

De officiële bron bevatte 212.738 relatievermeldingen. Na deterministische verwijdering van exact gelijke dubbele vermeldingen bleven 160.351 unieke relaties over. De bron- en unieke telling worden beide gerapporteerd; inhoudelijke relaties worden niet stilzwijgend verwijderd.

### Geometrie

```text
datasetversie_id
+ objecttype
+ identificatie
+ voorkomen_sleutel
+ geometrie_volgnummer
```

Daarmee kunnen meerdere geometrieën per voorkomen worden bewaard en blijven geometrieën ondubbelzinnig gekoppeld aan de juiste officiële voorkomensregel.

## Geometrieën

- coördinatenstelsel: **RD New / EPSG:28992**;
- opslag: driedimensionale PostGIS-geometrie;
- ruimtelijke index: GiST;
- omzetting naar WGS84 gebeurt pas aan de query- of servicelaag;
- officiële geometrieën worden niet automatisch gerepareerd;
- topologisch ongeldige geometrieën worden afzonderlijk in quarantaine bewaard met object-ID, voorkomen-ID, technische sleutel, volgnummer, WKT en `ST_IsValidReason`.

De officiële Assen-proef bevatte 122.388 geëxporteerde geometrieën:

- 122.375 geldig en ongewijzigd gepubliceerd;
- 13 in quarantaine;
- alle 13 betroffen `Self-intersection`;
- de som van published en quarantaine is exact gelijk aan het bronvolume.

## Importvolgorde

1. datasetversie registreren als staging;
2. objectkoppen laden;
3. voorkomens laden;
4. relaties laden;
5. geometrieën laden;
6. ongeldige geometrieën deterministisch naar quarantaine scheiden;
7. tellingen, checksums, objecttypen, historie, relaties en geometrieën valideren;
8. staging naar published overzetten;
9. actieve datasetversie atomisch omschakelen;
10. vorige actieve versie als rollbackversie bewaren.

## Upsertstrategie

Upserts zijn uitsluitend toegestaan binnen één nog niet gepubliceerde datasetversie en gebruiken de samengestelde sleutels hierboven. Een gepubliceerde datasetversie is immutable. Correcties vereisen een nieuwe datasetversie of een expliciete rollback.

## Transacties en rollback

- staging-loads mogen per batch worden gecommit en hervat;
- de omschakeling van de actieve datasetversie is één korte transactie;
- bij een fout vóór omschakeling blijft de huidige productieversie onaangetast;
- bij een fout na omschakeling kan de vorige actieve datasetversie opnieuw worden geactiveerd;
- de tijdelijke proef heeft bewezen dat een wijziging van de actieve datasetstatus volledig wordt teruggedraaid met `ROLLBACK`.

## Gemeten resultaten officiële Assen-proef

| Onderdeel | Resultaat |
|---|---:|
| Objecten | 128.745 |
| Voorkomens | 168.047 |
| Relatievermeldingen in bron | 212.738 |
| Unieke relaties geladen | 160.351 |
| Geometrieën uit bronexport | 122.388 |
| Geldige geometrieën gepubliceerd | 122.375 |
| Geometrieën in quarantaine | 13 |
| Dubbele officiële voorkomen-ID-groepen | 1 |
| Schemaduur | 1 seconde |
| Kopiëren, laden, valideren en publiceren | 40 seconden |
| Totale databaseduur | 41 seconden |
| Tabel- en indexopslag | 584.130.560 bytes |
| Omgerekend | circa 557 MiB |
| Rollback | geslaagd |

De opslagmeting omvat staging, published, indexen, datasetbeheer en geometriequarantaine in de tijdelijke proefdatabase.

## Go/no-go

### Go: BUILD 2A.2 technisch geslaagd

De geïsoleerde databaseproef is geslaagd omdat:

- officiële XML via de bestaande adapter en staginglaag is verwerkt;
- 168.047 van 168.047 reguliere records zijn geladen;
- de volledige object- en voorkomenhistorie behouden bleef;
- de samengestelde technische voorkomensleutel de bewezen bronduplicatie correct opvangt;
- relaties deterministisch en controleerbaar zijn geladen;
- 122.375 geldige geometrieën ongewijzigd zijn gepubliceerd;
- 13 ongeldige geometrieën traceerbaar in quarantaine zijn geplaatst;
- publicatie, actieve datasetversie en rollback technisch functioneren;
- exacte tabel- en indexgroottes en importduur zijn gemeten.

### Nog geen go voor Supabase of productie

Een productie-import blijft geblokkeerd totdat een afzonderlijke vervolgfase minimaal bewijst:

- de doel-Supabase beschikt over de vereiste PostGIS-configuratie en voldoende opslag;
- het uiteindelijke migratiebestand afzonderlijk is gereviewd;
- landelijke schaal en groeifactor zijn onderbouwd;
- importtijd, WAL-belasting, statement timeouts en lockgedrag in een Supabase-vergelijkbare omgeving zijn gemeten;
- referentiële dekking per relatietype inhoudelijk is gevalideerd;
- RLS, service-role toegang en read-only applicatierollen expliciet zijn ontworpen;
- backup, herstel en versieomschakeling operationeel zijn getest;
- geometriequarantaine en kwaliteitsmeldingen een beheersproces hebben;
- expliciete menselijke goedkeuring is gegeven voor iedere productie-uitvoering.

## Scopebeperkingen

BUILD 2A.2 wijzigde niet:

- Supabase-schema of data;
- productieconfiguratie;
- CRM-processen;
- Kadasterbestellingen;
- Pandenverkenner-UI;
- bestaande Objecten, Deals, Vastgoedkansen of acquisitiesignalen.
