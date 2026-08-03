# BAG BUILD 2A.4B — synthetische shadowproef

## Uitkomst

BUILD 2A.4B is op 3 augustus 2026 uitgevoerd op de private Lovable Cloud-remix
`6a89a812-bc24-4545-8da4-dcf44e209fcf`. Het bekende productieproject
`ljudxyrqoifhfikueric` is niet benaderd of gewijzigd.

De proef is geslaagd en volledig teruggerold. Er zijn na afloop nul BAG-rijen,
nul gebruikers en nul storage-objecten in de shadow achtergebleven.

## Gevonden en herstelde blocker

De eerste geometrie-insert stopte met `permission denied for schema extensions`.
De drie afgescheiden BAG-rollen hadden wel correcte toegang tot hun eigen BAG-schema's,
maar nog geen minimale `USAGE` op het private PostGIS-schema `extensions`.

De migratiekandidaat verleent daarom voortaan uitsluitend aan `bag_loader`,
`bag_publisher` en `bag_reader` `USAGE` op `extensions`. Er is geen toegang aan
`anon`, `authenticated` of `service_role` toegevoegd.

## Bewezen keten

De transactionele proef heeft via de echte database-rollen bewezen dat:

- `bag_loader` één synthetische datasetversie kan aanmaken;
- vijf BAG-objecttypen en vijf technische voorkomens gekoppeld kunnen worden;
- vier relaties hun bronobject behouden;
- een `PolygonZ` en `PointZ` in EPSG:28992 geaccepteerd worden;
- `bag_publisher` staging naar published kan kopiëren en de versie kan activeren;
- `bag_reader` exact één actieve dataset, vijf objecten, vijf voorkomens,
  vier relaties en twee geometrieën ziet;
- `ST_Covers` bevestigt dat het synthetische verblijfsobject in het pand ligt;
- SRID 28992 en drie dimensies voor beide geometrieën behouden blijven.

## Security-uitkomst

- `anon`, `authenticated` en `service_role`: geen BAG-schema-USAGE;
- `bag_loader`: kan niet rechtstreeks publiceren;
- `bag_publisher`: kan published-data niet wijzigen of verwijderen;
- `bag_reader`: kan staging niet lezen;
- tijdelijke Lovable Cloud `SET ROLE`-toestemming is transactioneel teruggerold;
- alle synthetische BAG-data is transactioneel teruggerold.

## Reproduceerbaarheid

De volledige proef staat in
`experiments/bag/2a4b/synthetic-shadow-probe.sql`. Het script faalt gesloten als
de BAG-schema's niet leeg zijn, gebruikt begrensde time-outs, bevat geen `COMMIT`
en eindigt alleen groen met `2A.4B_SYNTHETIC_SHADOW_PROBE_OK`.

## Vrijgave

De kleine end-to-end keten is groen. BUILD 2A.5 mag nu de landelijke schaal- en
capaciteitsproef voorbereiden. Productie blijft geblokkeerd tot de latere centrale
preflight en een afzonderlijke productiegoedkeuring.
