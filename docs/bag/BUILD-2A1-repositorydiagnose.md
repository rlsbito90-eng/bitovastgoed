# BUILD 2A.1 — Repositorydiagnose en proefbesluiten

Status: **diagnose, geen productie-implementatie**  
Branch: `feat/bag-build-2a1-volumeproef`

## 1. Bevestigde repositorycontext

### Supabase

De repository is gekoppeld aan Supabase-project `ljudxyrqoifhfikueric` via `supabase/config.toml`.

Dit is hetzelfde operationele project waarop de huidige CRM-frontend werkt. Daarom mag een landelijke BAG-proef niet rechtstreeks in bestaande productietabellen of ongeïsoleerde publieke tabellen worden uitgevoerd.

### Frontend en kaartstack

De applicatie gebruikt React, Vite en TanStack Query. De benodigde kaartbibliotheken zijn reeds aanwezig:

- `maplibre-gl`;
- `react-map-gl`;
- GeoJSON TypeScript-typen.

Voor BUILD 2A.1 hoeft dus geen nieuw kaartframework te worden gekozen. De proef moet alleen vaststellen welke serverquery- en tegelstrategie geschikt is voor de beoogde volumes.

### Routing en domeingrens

De Pandenverkenner staat momenteel onder `/vastgoedkansen/vinden`. De huidige pagina valt binnen de `VastgoedkansenProvider` en gebruikt bestaande CRM-context.

Voor de definitieve BAG-oplossing blijft de route bruikbaar als ingang, maar de data-accesslaag moet worden losgekoppeld van de operationele CRM-store:

```text
BAG Query Service
  -> BAG zoekresultaat / kaartlaag
  -> bewaarde verkenning
  -> expliciete CRM-preflight
  -> handmatige promotie naar Vastgoedkans
```

De volledige BAG-populatie mag niet via `DataStoreProvider` als één clientside dataset worden geladen.

## 2. Architectuurbesluiten voor de volumeproef

### Besluit A — geen landelijke proef in productie

De eerste uitvoerbare proef gebruikt een afzonderlijke lokale of tijdelijke database-omgeving. De productiedatabase ontvangt in BUILD 2A.1 geen BAG-bronrecords.

### Besluit B — proef op volledige gemeente, niet op willekeurige steekproef

Een willekeurige set records meet parsergedrag, maar niet de echte verdeling van:

- panden per VBO;
- adressen per VBO;
- geometriegrootte;
- straten, buurten en wijken;
- ruimtelijke indexen;
- viewportqueries.

Daarom gebruikt de eerste representatieve proef één volledige gemeente. De definitieve proefgemeente wordt gekozen op basis van beschikbaarheid van het officiële extract en moet zowel woon- als gemengd/commercieel vastgoed bevatten.

Voorkeursvolgorde:

1. Tilburg of Breda voor een beheersbare volledige gemeenteproef;
2. Amsterdam als tweede schaalproef;
3. pas daarna landelijke extrapolatie.

### Besluit C — pand is het primaire zoekobject

De kaart en resultatenlijst tonen primair BAG-panden. VBO's en nummeraanduidingen worden als onderliggende relaties ontsloten.

Een pand verschijnt dus eenmaal, ook als het meerdere adressen of verblijfsobjecten bevat.

### Besluit D — twee geometrieniveaus

Per pand worden twee geografische representaties onderscheiden:

1. `representatief_punt` voor clustering, selectie en kleine viewportquery's;
2. `geometrie` voor pandcontouren vanaf een passend zoomniveau.

Pandcontouren worden niet voor een volledige gemeente in één response naar de browser gestuurd.

### Besluit E — kaartquery is viewport-gebaseerd

De kaart vraagt uitsluitend records op binnen de zichtbare bounding box en met server-side filters. De API moet daarnaast een harde bovengrens en een indicatie van truncatie teruggeven.

### Besluit F — versieerbare publicatie

Een import schrijft eerst naar een niet-gepubliceerde datasetversie. Pas na validatie wordt één versie actief gemaakt. Zoek- en kaartquery's lezen uitsluitend uit de actieve versie.

## 3. Meetcontract

Iedere proefrun registreert minimaal:

### Bronbestand

- bronsoort;
- bestandsnaam;
- bestandsgrootte;
- checksum;
- peildatum;
- gemeente of geografische scope.

### Objectaantallen

- panden;
- verblijfsobjecten;
- nummeraanduidingen;
- openbare ruimten;
- woonplaatsen;
- pand–VBO-relaties;
- VBO–adresrelaties;
- geweigerde en onvolledige records.

### Tijd

- uitpakken;
- parsen;
- staging-load;
- validatie;
- publiceren;
- zoekindex opbouwen;
- ruimtelijke koppeling;
- totale doorlooptijd.

### Opslag

- ruwe stagingomvang;
- gepubliceerde bronlaag;
- zoekindex;
- geometrie-indexen;
- overige indexen;
- totale databasegroei.

### Queryprestaties

Te meten met koude en warme cache:

- gemeente tellen;
- wijk tellen;
- buurt tellen;
- straat zoeken;
- adres zoeken;
- pagineren op pand-ID;
- viewport met punten;
- viewport met contouren;
- functiefilter;
- bouwjaarfilter;
- gecombineerde acquisitiefilter.

Rapporteer voor iedere query minimaal p50, p95, maximum, aantal resultaten en eventuele truncatie.

## 4. Acceptatiegrenzen voor de proef

Dit zijn proefgrenzen, nog geen productie-SLA.

- Alle officiële object-ID's zijn idempotent opnieuw te verwerken.
- Geen automatische CRM-records.
- Import is hervatbaar of volledig veilig opnieuw uitvoerbaar.
- Object- en relatietellingen sluiten aantoonbaar aan op parseruitkomsten.
- Geen stille uitval: ieder geweigerd record heeft een reden.
- Viewportquery retourneert nooit onbegrensd alle pandcontouren.
- Lijstquery gebruikt server-side cursor- of keysetpaginering.
- Zoekresultaten zijn gebonden aan één gepubliceerde datasetversie.
- De proef produceert voldoende meetdata om dezelfde-database versus aparte-database te beslissen.

## 5. Infrastructuurbesluit dat nog openstaat

Na de gemeenteproef wordt gekozen tussen:

### Variant 1 — apart BAG-schema in huidige Supabase

Alleen acceptabel wanneer:

- import en indexbouw de CRM-latency niet merkbaar verstoren;
- opslag en back-upomvang passen;
- resource-isolatie voldoende aantoonbaar is;
- kaartquery's begrensd en voorspelbaar blijven.

### Variant 2 — afzonderlijke BAG-database

Voorkeursvariant wanneer landelijke import, geometrie-indexbouw of kaartbelasting het operationele CRM kan beïnvloeden.

CRM-preflight loopt dan via een kleine servicegrens en expliciete BAG-ID/adresmatching.

## 6. Kaartarchitectuur per zoomniveau

| Niveau | Primaire weergave | Bronquery |
|---|---|---|
| Nederland / provincie | aggregaties of tegels | aantallen per gebied |
| Gemeente / wijk | clusters of buurtaggregaties | gebiedsgebonden tellingen |
| Buurt / straat | pandpunten | begrensde viewportquery |
| Gebouwniveau | pandcontouren | geometrie voor zichtbare viewport |

De frontendkeuze MapLibre blijft geschikt. De proef vergelijkt voor de serverkant:

1. begrensde GeoJSON/RPC-responses;
2. gegenereerde vector tiles;
3. eventueel een hybride vorm.

## 7. Eerstvolgende uitvoerbare stap

De volgende commit voegt uitsluitend pure domeincontracten en tests toe voor:

- proefconfiguratie;
- importmetingen;
- objecttellingen;
- querymetingen;
- validatie van veilige proefgrenzen.

Deze code schrijft niets naar Supabase en doet geen netwerk- of bestandssysteemoperaties.