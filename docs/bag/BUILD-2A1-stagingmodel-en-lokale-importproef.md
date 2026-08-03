# BAG BUILD 2A.1 — Stagingmodel en lokale importproef

## Doel

Deze stap legt een deterministisch, technologie-onafhankelijk stagingmodel vast tussen de officiële XML-recordadapter en een toekomstige database-import.

Er worden geen tabellen aangemaakt en er worden geen databasewrites uitgevoerd.

## Stagingonderdelen

Het model bevat afzonderlijke verzamelingen voor:

- BAG-objecten;
- alle voorkomens, inclusief historie;
- relaties tussen BAG-objecten;
- geometrieën in Rijksdriehoekscoördinaten (`EPSG:28992`);
- validatie- en datakwaliteitsfouten.

## Actualiteitsselectie

Een voorkomen is actueel wanneer geen eindgeldigheid, eindregistratie of inactiviteitstijdstip aanwezig is.

Wanneer meerdere voorkomens actueel lijken:

1. blijft ieder voorkomen behouden;
2. wordt deterministisch de hoogste voorkomenidentificatie geselecteerd;
3. wordt `meerdere_actuele_voorkomens` geregistreerd.

## Geometrie

Geometrieën worden alleen in staging opgenomen wanneer:

- coördinaten aanwezig zijn;
- alle waarden eindig zijn;
- het aantal waarden deelbaar is door de opgegeven dimensie;
- de bron-CRS `EPSG:28992` is.

Transformatie naar WGS84 of Web Mercator hoort niet in deze laag.

## Lokale importproef

De tests simuleren een importbatch volledig in geheugen. Zij controleren:

- scheiding tussen object, voorkomen, relatie en geometrie;
- historiebehoud;
- selectie van het actuele voorkomen;
- expliciete foutregistratie bij conflicterende actualiteit;
- afwijzing van ongeldige geometrie;
- een identieke fingerprint bij een andere invoervolgorde.

## Vervolg

De volgende stap is een import-batchcontract met checkpointing, tellingen, release-gates en een dry-runrapport. Dat contract blijft read-only totdat een afzonderlijke database-BUILD wordt goedgekeurd.
