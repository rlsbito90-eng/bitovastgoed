# BAG BUILD 2A.3B — lokale Supabase-migratiekandidaat

## Status

Dit bestand beschrijft uitsluitend een lokale, nog niet uitgevoerde migratiekandidaat. Er is geen Supabase-project benaderd en er is geen schema of data gewijzigd.

## Doel

Vertaal het in BUILD 2A.2 bewezen PostGIS-model en het in BUILD 2A.3A/2A.3A.1 geharmoniseerde repositorycontract naar één reviewbaar Supabase-migratiebestand.

## Private schemas

- `bag_control`: datasetversies en geometriequarantaine;
- `bag_staging`: versiegebonden importtabellen;
- `bag_published`: gevalideerde, immutable publicatietabellen.

Er worden geen BAG-objecten in `public` geplaatst. De migratie wijzigt geen CRM-, Auth-, Storage- of Edge Function-objecten.

## Rollen en toegang

- `bag_loader`: kan stagingdata en afwijkingen laden;
- `bag_publisher`: kan staging lezen, published vullen en datasetstatus beheren;
- `bag_reader`: kan uitsluitend actieve published-data lezen.

Alle drie zijn `NOLOGIN`, `NOINHERIT` en `NOBYPASSRLS`. Er wordt geen lidmaatschap toegekend. `anon`, `authenticated` en `service_role` krijgen geen BAG-toegang. Alle tabellen hebben geforceerde RLS; policies gelden uitsluitend voor de drie afgescheiden BAG-rollen.

## Behouden databasecontract

- technische voorkomensleutel: `datasetversie_id + objecttype + identificatie + voorkomen_sleutel`;
- officiële `voorkomenidentificatie` blijft afzonderlijk indexeerbaar;
- geometriesleutel bevat aanvullend `geometrie_volgnummer`;
- geometrie blijft `GeometryZ` in EPSG:28992 met alleen `POINT` en `POLYGON`;
- GiST-indexen blijven aanwezig;
- ongeldige of niet-koppelbare geometrie blijft controleerbaar in quarantaine;
- automatische geometriecorrectie ontbreekt bewust;
- maximaal één actieve datasetversie per scope;
- gepubliceerde versies worden niet via upsert overschreven.

## Validatiegrens

De repositorytests controleren structuur, scheiding, sleutels, PostGIS-contract, grants, RLS en verboden CRM-mutaties. Deze omgeving heeft geen Supabase CLI, Docker of PostgreSQL-binaries. De SQL is daarom nog niet tegen een database uitgevoerd.

## Volgende gate

BUILD 2A.4A mag deze kandidaat pas uitvoeren nadat het bedoelde shadowproject ondubbelzinnig is geïdentificeerd. De preflight moet minimaal projectidentiteit, productie-indicatoren, PostGIS-schema en -versie, opslagruimte, rollen, pooling en time-outs controleren. Bij iedere productie-indicator stopt de uitvoering vóór de migratie.
