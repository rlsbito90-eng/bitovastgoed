# BUILD 1A.3 — Shadow schema + synthetische proef

Status: GROEN

Project: `xfygspvpeugxowxbcvnm` (BAG-shadow)

## Uitgevoerd

- `bag_search` schema aangemaakt.
- `bag_search.index_builds` aangemaakt.
- `bag_search.pand_search_index` aangemaakt.
- RLS ingeschakeld en geforceerd op beide tabellen.
- Directe rechten voor `PUBLIC`, `anon`, `authenticated` en `service_role` ingetrokken.
- Geen directe `bag_reader`-SELECT toegekend.
- Rollback-only synthetische proef uitgevoerd.

## Synthetisch bewijs

Resultaat:

`BUILD_1A3_SYNTHETIC_PROBE_OK`

De proef bewees:

- exact één actieve indexbuild per scope;
- een build met status `opbouw` wordt niet als actief behandeld;
- panden zonder VBO zijn toegestaan met `vbo_aantal = 0`;
- voor panden zonder VBO blijven `vbo_oppervlakte_som` en `vbo_oppervlakte_max` `NULL`;
- een tweede actieve build voor dezelfde scope wordt door de unieke partiële index geweigerd;
- de proef eindigt met `ROLLBACK`.

## Eindcontrole na rollback

- `bag_search.index_builds`: 0 rijen.
- `bag_search.pand_search_index`: 0 rijen.
- actieve Amsterdam-dataset voor scope `0363`: exact 1, ongewijzigd.
- geen privileges op de nieuwe tabellen voor app-rollen; alleen eigenaar `postgres` heeft tabelprivileges.

## Niet uitgevoerd

- geen echte Amsterdam-indexbuild;
- geen wijziging aan `bag_published`;
- geen wijziging aan `bag_control.datasetversies`;
- geen CRM-write;
- geen Edge Function-deploy;
- geen activatie van een zoekindex.

## Volgende stap

BUILD 1A.4: echte Amsterdam-v3 indexbuild ontwerpen en eerst read-only bronstatistieken en deterministische aggregatieregels bewijzen voordat miljoenen bronrijen naar `bag_search.pand_search_index` worden gematerialiseerd.
