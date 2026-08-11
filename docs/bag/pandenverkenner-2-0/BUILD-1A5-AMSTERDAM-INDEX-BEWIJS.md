# BUILD 1A.5 — Amsterdam indexbewijs

Status: gevalideerd; nog niet actief.

## Doel
Bouw de eerste volledige `bag_search.pand_search_index` voor Amsterdam v3 op het BAG-shadowproject, zonder de bestaande actieve BAG-dataset of de bestaande Pandenverkenner-queryroute te wijzigen.

## Project en bron
- Supabase-project: `xfygspvpeugxowxbcvnm`
- scope: `0363`
- actieve BAG-datasetversie: id `3`
- dataset: `v20260808-directional-v3`
- indexbuild: id `3`
- indexversie: `pv2-amsterdam-v1`

## Buildstrategie
De eerste monolithische insert/update bleek te zwaar voor de bestaande statement-timeout. De timeout is bewust niet verruimd.

De build is daarom gecontroleerd opgesplitst in:
1. basisindex met exact één deterministisch gekozen Pand-voorkomen per pand;
2. geometrie + centroid;
3. VBO-verrijking in deterministische hashbatches;
4. adresverrijking via vooraf gededupliceerde helperlagen en kleinere hashbatches;
5. integriteitscontrole over de volledige build;
6. pas daarna status `gevalideerd`.

## Pandselectie
Winnaar per Pand:
1. hoogste `begin_geldigheid` (`NULLS LAST`);
2. hoogste `velden.tijdstipRegistratie`;
3. hoogste `voorkomen_sleutel` als totale tie-breaker.

Resultaat:
- 211.112 indexrijen;
- 211.112 verwachte panden;
- geen dubbele panden.

## VBO-verrijking
Dezelfde winnaarlogica is vóór aggregatie toegepast op VBO-voorkomens.

Eindresultaat:
- 143.988 panden met VBO;
- 67.124 panden zonder VBO;
- 640.850 totale Pand↔VBO-koppelingen;
- `vbo_aantal`, `vbo_oppervlakte_som`, `vbo_oppervlakte_max` en `gebruiksdoelen` zijn pas na deduplicatie berekend;
- 0 VBO-semantiekfouten in de eindcontrole.

Panden zonder VBO blijven in de index met:
- `heeft_vbo=false`;
- `vbo_aantal=0`;
- `vbo_oppervlakte_som=NULL`;
- `vbo_oppervlakte_max=NULL`;
- lege gebruiksdoelen.

## Adresprovenance
Tijdens de adresbuild bleek dat 6 geadresseerde panden een geldig BAG-hoofdadresobject hebben terwijl de leesbare straatketen incompleet is.

Daarom is het contract aangescherpt:
- `adres_count>0` vereist een deterministisch `primair_nummeraanduiding_id`;
- `primair_adres` mag NULL blijven wanneer de BAG-bronketen geen volledige leesbare straatnaam oplevert;
- geen fictieve straat- of adreswaarde wordt gemaakt.

De constraint `pand_search_index_primary_address_check` is eerst `NOT VALID` toegevoegd, daarna zijn alle adressen inclusief BAG-Nummeraanduiding-ID opnieuw opgebouwd en vervolgens is de constraint succesvol gevalideerd.

Eindresultaat:
- 143.988 panden met minimaal één adres;
- 640.850 totale unieke pand-adrescombinaties;
- 0 panden met `adres_count>0` zonder `primair_nummeraanduiding_id`;
- 6 panden met een geldig primair BAG-adresobject maar zonder volledig leesbaar adres.

## Geometrie
Eindcontrole:
- 0 ontbrekende pandgeometrieën;
- 0 ontbrekende centroids;
- geometrie blijft RD New / SRID 28992.

## Finale buildmetadata
Build `id=3`:
- status: `gevalideerd`;
- `verwacht_panden`: 211.112;
- `gebouwd_panden`: 211.112;
- `gebouwd_zonder_vbo`: 67.124;
- `validatie_fouten`: 0;
- `gevalideerd_op`: 2026-08-11T20:06:53.276714Z.

## Veiligheidsgrens
Niet uitgevoerd in BUILD 1A.5:
- geen activatie van indexbuild 3;
- geen wijziging aan `bag_control.datasetversies`;
- geen wijziging aan `bag_published`;
- geen vervanging/verwijdering van bestaande `bag_service.zoek_panden`;
- geen Edge Function-deploy;
- geen CRM-write;
- geen Off-Market Radar-koppeling;
- geen Kadasteractie.

## Volgende gate — BUILD 1A.6
1. atomisch activeren van build 3 voor scope `0363`;
2. read-only queryfunctie Pandenverkenner 2.0 naast de bestaande queryroute;
3. aantonen dat alleen een actieve indexbuild die bij de actieve BAG-dataset hoort querybaar is;
4. oude queryroute intact houden totdat pariteit en nieuwe filters bewezen groen zijn.
