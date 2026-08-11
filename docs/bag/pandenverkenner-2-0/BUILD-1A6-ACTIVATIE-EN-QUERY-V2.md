# BUILD 1A.6 — Activatie + read-only query v2

Status: database/runtimecontract actief; Edge Function transportcode voorbereid maar nog niet gedeployed.

## Activatie
Op BAG-shadowproject `xfygspvpeugxowxbcvnm` is Amsterdam search-index build `id=3` atomair geactiveerd.

Bewezen status:
- datasetversie_id: 3;
- scope: 0363;
- indexversie: `pv2-amsterdam-v3-1`;
- status: `actief`;
- verwacht_panden: 211.112;
- gebouwd_panden: 211.112;
- validatie_fouten: 0.

De activatiemigratie controleerde vóór activatie expliciet dat de actieve BAG-dataset voor scope 0363 datasetversie_id=3 is, build 3 gevalideerd is, 0 validatiefouten heeft en exact 211.112 indexrijen bevat.

## Queryfunctie v2
Nieuwe functie:

`bag_service.zoek_panden_v2(...)`

Eigenschappen:
- `SECURITY DEFINER`;
- uitsluitend `EXECUTE` voor `bag_reader`;
- geen directe SELECT-rechten op `bag_search` voor app-rollen;
- leest alleen een `bag_search.index_builds`-rij met status `actief`;
- vereist dat die build hoort bij dezelfde dataset die in `bag_control.datasetversies` actief is voor de scope;
- vereist `validatie_fouten=0` en `gebouwd_panden=verwacht_panden`;
- keyset-paginering op pandidentificatie;
- limiet 1–250.

Ondersteunde server-side filters:
- bouwjaar van/tot;
- exacte BAG-pandstatus;
- VBO-oppervlakte som van/tot;
- VBO-oppervlakte max van/tot;
- VBO-aantal van/tot;
- gebruiksdoel;
- gemengd ja/nee;
- VBO-modus: alle / met_vbo / zonder_vbo.

## Runtimeproeven
Bewezen:
- v2-resultaten komen uit datasetversie_id=3 en index_build_id=3;
- `zonder_vbo` retourneert panden met `heeft_vbo=false`, `vbo_aantal=0`, NULL-oppervlakten en adres_count=0;
- gecombineerde filterproef bouwjaar 1900–1950 + VBO-som 100–1000 + VBO-aantal 1–20 + woonfunctie + met_vbo leverde uitsluitend passende resultaten;
- keyset-paginering leverde twee opeenvolgende niet-overlappende pagina's;
- bestaande `bag_service.zoek_panden(text,text,integer)` blijft aanwezig als fallback.

## Transportvoorbereiding
Op de repositorybranch is de bestaande `bag-query-service` uitgebreid met een afzonderlijke `action='search_v2'`.
De oude `action='search'` blijft ongewijzigd aanwezig.

De v2-transportlaag valideert clientinput vóór database-executie en behoudt:
- CRM-authenticatie;
- admin/medewerker-rolcontrole;
- scope-allowlist;
- shadow-projectbinding;
- `SET LOCAL ROLE bag_reader`.

Edge Function deploy is nog niet uitgevoerd in deze BUILD. Eerst CI groen.
