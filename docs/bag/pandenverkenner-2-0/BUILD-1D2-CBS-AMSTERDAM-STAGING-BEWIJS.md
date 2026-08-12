# BUILD 1D.2 — CBS Amsterdam staging- en dekkingsbewijs

Status: groen; actieve `pand_search_index` is niet verrijkt.

## Bronpakket
- CBS Wijk- en Buurtkaart 2025 via PDOK OGC API Features.
- gemeentecode: `GM0363`.
- bronartifact: `9126107462`.
- buurten: 519 unieke Amsterdam-buurten.
- wijken: 111 unieke Amsterdam-wijken.
- buurt→wijk-referenties zonder match: 0.
- buurten SHA-256: `bd5cd7fdc1d1f23a7b6ae2bf36e309872c1b7ab8243d127fbc989e3b869c77e0`.
- wijken SHA-256: `b76c1ffa4a606994184fcf45462cae4127d0acb43802965f987d37994a82a725`.

De officiële bron bevat ook alfanumerieke codes, onder andere `BU0363AA01`; daarom accepteert het contract alfanumerieke wijk-/buurtsegmenten.

## Staging
Op BAG-shadowproject `xfygspvpeugxowxbcvnm` zijn uitsluitend afgeschermde stagingtabellen geladen:
- `bag_search.cbs_buurten_staging`: 519 rijen;
- `bag_search.cbs_wijken_staging`: 111 rijen.

Beide gebruiken `MultiPolygon, EPSG:28992`, hebben forced RLS en geven geen DML-rechten aan `anon`, `authenticated` of `bag_reader`.

## Centroiddekking actieve Amsterdam-index
Actieve build: `index_build_id=3`, scope `0363`, 211.112 panden.

`ST_Covers(CBS-buurtpolygon, pand-centroid)` geeft:
- totaal: 211.112;
- exact één buurtmatch: 211.082;
- nul buurtmatches: 30;
- meerdere buurtmatches: 0;
- maximum aantal matches per pand: 1.

De 30 uitzonderingen hebben ook geen CBS-wijkmatch. 27 liggen aan de Kalfjeslaan/gemeentegrens; daarnaast zijn er twee panden zonder primair adres en één Weesp-pand. Er wordt bewust geen nearest-neighbour fallback toegepast: zonder officiële polygonmatch blijven wijk/buurt NULL.

## Harde bewijsgrens
Na de stagingprobe:
- `wijk_code` gevuld op actieve index: 0;
- `buurt_code` gevuld op actieve index: 0;
- build 3 blijft `actief`;
- BAG-brondata en CRM zijn niet gewijzigd.

## Volgende gate
BUILD 1D.3 mag alleen atomisch 211.082 uniek gekoppelde panden verrijken, 30 uitzonderingen NULL laten en CBS-bronjaar/checksums expliciet vastleggen. Deze actieve-indexwrite vereist afzonderlijke autorisatie.
