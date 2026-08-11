# PLAN — Pandenverkenner 2.0

Status: ontwerpbesluit / implementatiegrens

## 1. Doel

Pandenverkenner 2.0 wordt een snelle, private zoekmachine bovenop de gevalideerde BAG-publicatielaag. De module blijft gescheiden van de operationele CRM-tabellen en van Off-Market Radar.

De kern is een denormaliseerde zoekindex met één rij per huidig operationeel pand. Deze index bevat bronfeiten en vooraf berekende zoekdimensies, zodat zoekopdrachten geen herhaalde live-joins en aggregaties over de volledige BAG-publicatielaag nodig hebben.

## 2. Harde architectuurprincipes

### 2.1 BAG-feit en Bito-afleiding strikt scheiden

De zoekindex bevat uitsluitend BAG-bronfeiten, deterministische technische aggregaties en geografische bronverrijking.

Voorbeeld:

- BAG-feit: `pandstatus_huidig = 'Sloopvergunning verleend'`
- Bito-afleiding: `acquisitie_classificatie = 'sloop_herontwikkeling'`

Bito-acquisitieclassificaties worden niet als BAG-feit in de kernindex opgeslagen. Ze komen later in een afzonderlijke classificatielaag of deterministic classifier met expliciete versieerbare regels.

### 2.2 Eén rij per huidig pand

De index representeert het actuele operationele pand binnen één actieve/gevalideerde datasetversie en scope.

### 2.3 Geen generiek oppervlakteveld

BAG kent geen eenduidige pand-gebruiksoppervlakte. Daarom worden minimaal afzonderlijk gemodelleerd:

- `vbo_oppervlakte_som`
- `vbo_oppervlakte_max`
- `vbo_aantal`
- `heeft_vbo`

Dit voorkomt dat een pand met veel kleine VBO's semantisch gelijk wordt behandeld aan een pand met één groot VBO.

### 2.4 Panden zonder VBO zijn first-class zoekobjecten

Panden zonder actueel gekoppeld VBO worden al in het MVP meegenomen.

Voor deze panden geldt:

- `heeft_vbo = false`
- `vbo_aantal = 0`
- `vbo_oppervlakte_som = NULL`
- `vbo_oppervlakte_max = NULL`

Oppervlakte wordt nadrukkelijk niet als `0` gemodelleerd.

### 2.5 Footprint is geen gebruiksoppervlakte

Een geometrisch berekende gebouwfootprint mag later als afzonderlijke proxy worden toegevoegd, bijvoorbeeld `footprint_oppervlakte_m2`, maar nooit onder een generiek of VBO-oppervlaktelabel.

Footprint wordt in eerste instantie wel toonbaar, maar niet standaard als m²-filter gebruikt.

### 2.6 Provenance is onderdeel van het zoekresultaat

Elke indexrij moet herleidbaar zijn naar minimaal:

- `datasetversie_id`
- `scope_code`
- BAG-pandidentificatie
- actueel voorkomen / voorkomen_sleutel waar relevant
- index-/verrijkingsversie

De index wordt alleen vernieuwd na een nieuwe gevalideerde/actieve BAG-dataset. Geen blinde dagelijkse full refresh in het MVP.

## 3. Zoekindex — conceptueel contract

Werknaam: `pand_search_index`.

Minimale dimensies:

### Identiteit en provenance

- `datasetversie_id`
- `scope_code`
- `pand_identificatie`
- `voorkomen_sleutel`
- `index_versie`

### BAG-feiten

- `pandstatus_huidig`
- `oorspronkelijk_bouwjaar`
- oorspronkelijke pandgeometrie
- centroid

### VBO-aggregaties

- `heeft_vbo`
- `vbo_aantal`
- `vbo_oppervlakte_som`
- `vbo_oppervlakte_max`
- verzameling actuele gebruiksfuncties/gebruiksdoelen
- afgeleid technisch kenmerk `is_gemengd` op basis van meerdere actuele functies

`is_gemengd` is een deterministische zoekdimensie op BAG-gebruiksdoelen, geen acquisitiesignaal.

### Adresrepresentatie

Een pand kan meerdere VBO's en adressen hebben. Daarom wordt adressering expliciet gemodelleerd:

- `primair_adres`
- `primair_straat`
- `primair_huisnummer`
- `primair_postcode`
- `primair_plaats`
- `adres_count`

Optioneel later:

- `adressen[]`

De keuze van het primaire adres moet deterministisch zijn. Geen willekeurige rijvolgorde. De exacte BAG-regel wordt vóór BUILD vastgelegd en getest.

UI-voorbeeld:

`Wibautstraat 131 e.o. · 18 adressen`

## 4. Gebiedsverrijking

Gebiedsverrijking wordt vooraf gematerialiseerd en niet bij iedere zoekopdracht live ruimtelijk gejoint.

MVP:

- `gemeente_code`
- `gemeente_naam`
- `cbs_jaarversie`
- `wijk_code`
- `wijk_naam`
- `buurt_code`
- `buurt_naam`

Amsterdam kan aanvullend een expliciete stadsdeelverrijking krijgen.

Voor wijk/buurt is centroid → point-in-polygon acceptabel als MVP-classificatie. De oorspronkelijke pandgeometrie blijft echter beschikbaar en is leidend voor latere viewport- en polygonselectie.

## 5. Querycontract Pandenverkenner 2.0

De huidige zoekactie met alleen scope, cursor en limiet wordt uitgebreid naar server-side filtering.

Fase 1C ondersteunt minimaal:

- gemeente/scope
- wijk
- buurt
- bouwjaar van/tot
- BAG-pandstatus
- `vbo_oppervlakte_som` van/tot
- `vbo_oppervlakte_max` van/tot
- `vbo_aantal` van/tot
- gebruiksfunctie
- gemengd ja/nee
- VBO-modus:
  - alle panden
  - alleen panden met VBO
  - alleen panden zonder VBO
- zoekterm/adres waar technisch verantwoord
- deterministische sortering
- keyset-paginering

Filters worden server-side toegepast vóór paginering. De huidige client-side filtering van uitsluitend de geladen pagina is niet het eindmodel.

## 6. Pandenverkenner versus CRM

Pandenverkenner 2.0 blijft een read/search-laag.

De bestaande handmatige preflight- en promotieflow blijft de grens naar CRM/Vastgoedkansen:

1. zoeken/filteren in BAG;
2. expliciete selectie;
3. centrale preflight;
4. handmatige bevestiging;
5. pas daarna gecontroleerde CRM-promotie.

Geen automatische opslag vanuit zoekresultaten.

Kadasteracties blijven volledig handmatig en vallen buiten dit PLAN.

## 7. Off-Market Radar

In Fase 1 wordt geen functionele koppeling gebouwd.

Wel voorbereiden:

- gedeelde termen waar semantisch correct;
- stabiele BAG-identificatie als mogelijke toekomstige referentie;
- duidelijke scheiding tussen bronfeit, zoekdimensie en businessclassificatie.

Fase 2 kan een afzonderlijke laag introduceren, bijvoorbeeld `pand_search_classifications`, met:

- classificatiecode
- classifier-/regelversie
- afleidingsreden
- relevante bronfeiten
- berekend_op

Een acquisitieclassificatie wordt explainable en opnieuw berekenbaar gehouden.

## 8. Fasering

### Fase 1A — Search-index fundament

- één rij per huidig operationeel pand;
- scope/gemeente;
- BAG-status;
- bouwjaar;
- geometrie + centroid;
- VBO som/max/aantal/functies;
- `heeft_vbo`;
- primair adres + `adres_count`;
- provenance/datasetversie;
- panden zonder VBO inbegrepen;
- contract- en integriteitstests;
- nog geen wijziging aan de productie-CRM.

### Fase 1B — Gebiedsverrijking

- CBS jaarversie;
- gemeente;
- wijk;
- buurt;
- optioneel Amsterdam stadsdeel;
- deterministische spatial-enrichmenttests.

### Fase 1C — Nieuwe zoek-UI en queryservice

- server-side filters;
- querycontract 2.0;
- gemeente/wijk/buurt;
- bouwjaar;
- status;
- som/max oppervlakte;
- VBO-aantal;
- gebruiksfunctie;
- gemengd;
- inclusief/alleen panden zonder VBO;
- bestaande selectie/preflight/promotieflow behouden.

### Fase 2 — Intelligence

- Bito-acquisitieclassificaties;
- explainable `waarom matcht dit?`;
- presets/zoekprofielen;
- architectonisch voorbereide maar expliciete Off-Market Radar-brug.

### Fase 3 — Spatial & multi-region

- polygonselectie;
- viewportselectie op echte pandgeometrie;
- tweede en volgende gemeente;
- refresh/incremental pipeline.

## 9. Refreshstrategie

MVP:

- indexbuild gekoppeld aan een nieuwe gevalideerde datasetversie;
- index vóór activatie of als gecontroleerde post-importstap volledig valideren;
- alleen een complete, consistente index beschikbaar maken voor queries;
- geen gedeeltelijke zichtbaarheid tijdens rebuild;
- actieve dataset en bijbehorende zoekindex moeten aantoonbaar bij elkaar horen.

Later:

- incremental/dagelijks verversen kan worden onderzocht nadat mutatiegedrag, performance en herstelpad bewezen zijn.

## 10. Niet doen in Fase 1

- geen automatische Off-Market Radar-signalen;
- geen automatische Kadasterbestellingen of -acties;
- geen businessclassificaties in BAG-bronvelden;
- geen footprint als gebruiksoppervlakte presenteren;
- geen live zware VBO-aggregaties als structureel zoekmodel;
- geen willekeurig gekozen hoofdadres;
- geen client-only filters over slechts één geladen pagina als definitieve zoeksemantiek;
- geen database- of deploymentwijziging zonder afzonderlijke BUILD en bijbehorende veiligheidscontrole.

## 11. Migratiepad vanaf huidige implementatie

De huidige `bag_service.zoek_panden` blijft tijdens de opbouw het compatibele pad.

De overgang gebeurt in kleine stappen:

1. indexcontract + pure tests;
2. indexbuild in geïsoleerde BAG-shadowomgeving;
3. integriteits- en performancebewijs;
4. read-only queryfunctie 2.0 naast de bestaande functie;
5. clienttransport 2.0 achter expliciete interface/featuregrens;
6. UI-filters omzetten naar server-side query;
7. regressietest van selectie/preflight/promotie;
8. pas na bewezen pariteit oude live-aggregatie uitfaseren.

Geen big-bang vervanging.

## 12. Acceptatiecriteria Fase 1

Fase 1 is pas gereed als aantoonbaar geldt:

- elk huidig operationeel pand in scope staat maximaal één keer in de index;
- panden zonder VBO ontbreken niet;
- VBO-oppervlakte NULL/0-semantiek is correct;
- som, max en aantal zijn afzonderlijk correct;
- primair adres is deterministisch en `adres_count` klopt;
- bronstatus blijft bronstatus;
- geen acquisitieclassificatie is in de BAG-kernindex vermengd;
- datasetversie/provenance is volledig herleidbaar;
- wijk/buurtverrijking is versieerbaar;
- filters worden vóór paginering server-side toegepast;
- querylimieten, auth, scope-allowlist en `bag_reader`-grens blijven intact;
- selectie/preflight/promotie blijft handmatig;
- bestaande actieve Amsterdam-dataset wordt niet gewijzigd door het ontwerpwerk.

## 13. Besluiten

1. Refresh start datasetgebonden, niet dagelijks blind.
2. Footprint mag als expliciete proxy worden getoond, niet standaard als m²-filter.
3. Off-Market Radar wordt semantisch voorbereid, nog niet functioneel gekoppeld.
4. BAG-feit en Bito-classificatie blijven strikt gescheiden.
5. Adresmodel is expliciet onderdeel van de zoekindex.
6. Panden zonder VBO horen vanaf Fase 1A bij het MVP.
7. Provenance/datasetversie is verplicht onderdeel van de index.
