# BUILD 1A.4 — Amsterdam bronvalidatie

Status: read-only bronvalidatie afgerond; echte indexbuild nog niet uitgevoerd.

## Dataset
- project: `xfygspvpeugxowxbcvnm`
- scope: `0363`
- actieve datasetversie_id: `3`
- dataset: `v20260808-directional-v3`

## Pandselectie
Amsterdam v3 bevat 211.112 Pand-objecten en 211.129 rijen met `is_actueel=true` voor Pand.
16 panden hebben meer dan één actueel voorkomen (17 extra actuele voorkomens; max 3).

Deterministische winnaar per Pand:
1. hoogste `begin_geldigheid` (`NULLS LAST`);
2. hoogste `velden.tijdstipRegistratie`;
3. hoogste `voorkomen_sleutel` als totale tie-breaker.

Deze regel levert exact 211.112 winnaars / 211.112 unieke panden.

## VBO-selectie
Amsterdam v3 bevat 630.005 VBO-objecten en 630.947 actuele VBO-voorkomens.
927 VBO's hebben meer dan één actueel voorkomen (942 extra; max 3).
Dezelfde deterministische winnaarregel levert exact 630.005 winnaars / 630.005 unieke VBO's.

Daarom mag de zoekindex nooit rechtstreeks alle `is_actueel=true` VBO-voorkomens aggregeren.

## Pand ↔ VBO
Na VBO-deduplicatie:
- 143.988 panden hebben ten minste één VBO;
- 67.124 panden hebben geen VBO;
- 640.850 unieke Pand↔VBO-koppelingen;
- 67.762 panden hebben meerdere VBO's;
- maximum: 967 VBO's aan één pand.

Panden zonder VBO blijven vanaf MVP in de index met `heeft_vbo=false`, `vbo_aantal=0` en NULL voor som/max-oppervlakte.

## Geometrie
Voor alle 211.112 gekozen Pand-voorkomens bestaat exact een gekoppelde geometrie op dezelfde `voorkomen_sleutel`:
- met geometrie: 211.112;
- zonder geometrie: 0;
- ongeldige geometrie: 0;
- verkeerde SRID: 0.

De echte pandgeometrie blijft leidend; centroid wordt afgeleid voor gebiedsverrijking en snelle kaartoperaties.

## Adresbron
Iedere gekozen VBO heeft exact één `hoofdadresIds`-relatie: 630.005 VBO's / 630.005 hoofdadreslinks.
Over de Pand↔VBO-koppelingen resulteert dit in:
- 143.988 panden met minimaal één adres;
- 640.850 unieke pand-adrescombinaties;
- 67.762 panden met meerdere adressen;
- maximum: 967 adressen aan één pand.

Panden zonder VBO hebben vanuit deze route geen adres. Dat is geen reden om ze uit de index te laten.
Primair adres moet deterministisch uit de beschikbare VBO-hoofdadressen worden gekozen; `adres_count` bewaart de multipliciteit.

## VBO-oppervlaktekwaliteit
Alle 630.005 gekozen VBO's hebben een numerieke BAG-oppervlakte en geen negatieve waarde.
Waargenomen range: 1–999.999 m².
Er zijn 20 VBO's >=100.000 m², 606 >=10.000 m² en 10 exact 999.999 m².

Deze waarden zijn bronfeiten en mogen niet stilzwijgend worden gecorrigeerd. Voor zoekkwaliteit moet 999.999 als expliciete datakwaliteits-/sentinelcase worden onderzocht en eventueel als waarschuwing/provenance worden gemarkeerd; niet als footprint vervangen.

## Gate voor echte Amsterdam-indexbuild
Voor schrijven van de 211.112 echte indexrijen moet de buildquery aantoonbaar:
- eerst Pand en VBO deterministisch dedupliceren;
- VBO-aggregaties pas daarna berekenen;
- panden zonder VBO behouden;
- geometrie op de gekozen Pand-`voorkomen_sleutel` koppelen;
- primair adres deterministisch kiezen;
- tellingen en NULL-semantiek vóór activatie valideren;
- de nieuwe build eerst als `opbouw`, daarna `gevalideerd` behandelen;
- geen bestaande actieve BAG-dataset wijzigen.
