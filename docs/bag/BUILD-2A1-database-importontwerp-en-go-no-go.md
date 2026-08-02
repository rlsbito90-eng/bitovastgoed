# BUILD 2A.1-L — Database-importontwerp en go/no-go

## Status

Ontwerp gereed. Er is geen migratie uitgevoerd en er is geen BAG-data naar Supabase of productie geschreven.

## Doel

Dit ontwerp vertaalt de geslaagde Assen-volumeproef naar een toekomstig, controleerbaar database-importpad. Het beschrijft uitsluitend de beoogde structuur en releasevoorwaarden voor BUILD 2A.2.

## Architectuurbesluit

De BAG-laag gebruikt twee strikt gescheiden zones:

1. **Staging** — volledige import van één datasetversie, inclusief historie, relaties, geometrieën en datakwaliteitsmeldingen.
2. **Published** — alleen gevalideerde datasetversies die door kaart-, zoek- en selectiediensten mogen worden gelezen.

Publicatie vindt niet plaats door bestaande rijen in-place te overschrijven. Een nieuwe datasetversie wordt eerst volledig geladen en gevalideerd. Daarna wordt de actieve datasetreferentie atomisch omgeschakeld. De vorige actieve versie blijft beschikbaar voor rollback.

## Voorgestelde tabellen

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

```text
datasetversie_id + objecttype + identificatie + voorkomenidentificatie
```

### Relatie

```text
datasetversie_id + bron_objecttype + bron_identificatie + relatietype + doel_identificatie
```

### Geometrie

```text
datasetversie_id + objecttype + identificatie + voorkomenidentificatie
```

Hierdoor is een import idempotent: hetzelfde record binnen dezelfde datasetversie kan niet dubbel worden vastgelegd.

## Geometrieën

- coördinatenstelsel: **RD New / EPSG:28992**;
- puntgeometrie: `geometry(PointZ,28992)`;
- vlakgeometrie: `geometry(PolygonZ,28992)`;
- ruimtelijke index: GiST;
- de bronvorm en dimensie blijven expliciet controleerbaar;
- omzetting naar WGS84 voor kaartclients gebeurt pas aan de query- of servicelaag, niet als primaire opslagvorm.

## Importvolgorde

1. datasetversie registreren als staging;
2. objectkoppen laden;
3. voorkomens laden;
4. relaties laden;
5. geometrieën laden;
6. tellingen, checksums, objecttypen, historie en geometrieën valideren;
7. referentiële dekking rapporteren;
8. staging naar published overzetten;
9. actieve datasetversie atomisch omschakelen;
10. vorige actieve versie als rollbackversie bewaren.

## Relaties en ontbrekende doelen

Een ontbrekend doelobject leidt niet tot stille verwijdering van de bronrelatie. De relatie blijft in staging aanwezig met een validatiestatus. Publicatie kan afhankelijk van de vastgestelde gate worden geblokkeerd of met een expliciete waarschuwing worden toegestaan.

## Upsertstrategie

Upserts zijn uitsluitend toegestaan binnen één nog niet gepubliceerde datasetversie en gebruiken de samengestelde sleutels hierboven. Een gepubliceerde datasetversie is immutable. Correcties vereisen een nieuwe datasetversie of een expliciete rollback.

## Transacties en rollback

- staging-loads mogen per batch worden gecommit en hervat;
- de omschakeling van de actieve datasetversie is één korte transactie;
- bij een fout vóór omschakeling blijft de huidige productieversie onaangetast;
- bij een fout na omschakeling kan de vorige actieve datasetversie opnieuw worden geactiveerd;
- verwijdering van oude versies valt buiten BUILD 2A.2 en vereist een afzonderlijk bewaarbeleid.

## Capaciteitsindicatie op basis van Assen

De Assen-proef leverde:

- 128.745 objecten;
- 168.047 voorkomens;
- 212.738 relaties;
- 122.388 geometrieën.

Deze aantallen bewijzen de verwerkingsvorm, maar zijn onvoldoende om de exacte landelijke opslagomvang te garanderen. Voor landelijke capaciteit moet BUILD 2A.2 eerst een echte databaseproef met gemeten tabel- en indexgroottes uitvoeren.

## Go/no-go voor BUILD 2A.2

### Go voor een geïsoleerde databaseproef

BUILD 2A.2 mag worden voorbereid omdat:

- de officiële bron volledig is verwerkt;
- alle zeven objecttypen aanwezig zijn;
- 168.047 van 168.047 reguliere records zijn verwerkt;
- historie, relaties en geometrieën behouden blijven;
- de release-gates van de dry-run slagen;
- het databaseschema conceptueel idempotent en rollbackbaar is ontworpen.

### Nog geen go voor productie-import

Een productie-import blijft geblokkeerd totdat BUILD 2A.2 minimaal bewijst:

- PostGIS is beschikbaar in de doelomgeving;
- migraties zijn afzonderlijk gereviewd;
- tabel- en indexgroottes zijn gemeten;
- importtijd en lockgedrag zijn gemeten;
- referentiële integriteit is inhoudelijk gecontroleerd;
- RLS en service-role toegang zijn expliciet ontworpen;
- backup en rollback zijn in een geïsoleerde omgeving getest;
- er is expliciete menselijke goedkeuring voor productie-uitvoering.

## Scopebeperkingen

Dit ontwerp wijzigt niet:

- Supabase-schema of data;
- productieconfiguratie;
- CRM-processen;
- Kadasterbestellingen;
- Pandenverkenner-UI;
- bestaande Objecten, Deals, Vastgoedkansen of acquisitiesignalen.
