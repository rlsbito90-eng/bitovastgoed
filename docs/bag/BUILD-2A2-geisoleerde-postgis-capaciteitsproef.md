# BAG BUILD 2A.2 — geïsoleerde PostGIS-capaciteitsproef

## Doel

Deze build meet of het in BUILD 2A.1 ontworpen BAG-databasemodel technisch uitvoerbaar is bij het reeds bewezen Assen-volume.

De proef draait uitsluitend in een tijdelijke PostgreSQL/PostGIS-service binnen GitHub Actions. Er wordt geen verbinding gemaakt met Supabase, productie of CRM.

## Volumeprofiel

De proef gebruikt deterministische synthetische gegevens met exact deze gemeten omvang:

- 128.745 objecten;
- 168.047 voorkomens;
- 212.738 relaties;
- 122.388 geometrieën.

De synthetische objecttypeverdeling is alleen bedoeld om verschillende BAG-objecttypen en geometrievormen te vertegenwoordigen. Zij is geen inhoudelijke kopie van de officiële Assen-data.

## Wat wordt bewezen

1. PostGIS kan worden geactiveerd.
2. Het staging- en published-schema kan worden aangemaakt.
3. Primaire sleutels, foreign keys en geometriechecks accepteren het volume.
4. RD New-geometrieën met SRID 28992 kunnen worden geladen.
5. GiST-, B-tree- en GIN-indexen kunnen worden opgebouwd.
6. De stagingdataset kan transactioneel naar published worden gekopieerd.
7. Er kan slechts één actieve datasetversie per scope bestaan.
8. Een wijziging van de actieve datasetversie kan volledig worden teruggedraaid.
9. Tabel- en indexopslag, laadtijd en enkele queryplannen kunnen worden gemeten.

## Wat niet wordt bewezen

- dat de echte officiële XML-records al naar SQL-rijen worden gestreamd;
- dat de synthetische payload dezelfde opslagomvang heeft als alle echte BAG-velden;
- dat productie-Supabase voldoende capaciteit heeft;
- dat RLS en service-role-beleid definitief zijn;
- dat een landelijke import binnen de gewenste tijd en kosten past;
- dat publicatie naar de Pandenverkenner al gereed is.

## Veiligheidsgrenzen

De workflow:

- gebruikt uitsluitend `workflow_dispatch`;
- heeft alleen `contents: read`;
- gebruikt geen repositorysecrets;
- gebruikt een vaste lokale testdatabase op `127.0.0.1`;
- weigert een niet-lokale database-URL;
- bevat geen Supabase-projectreferentie;
- schrijft niet naar CRM-tabellen;
- publiceert alleen rapporten en logs.

## Bestanden

- `experiments/bag/2a2/schema.sql`
- `experiments/bag/2a2/load-volumeprofiel.sql`
- `scripts/bag/run-2a2-capaciteitsproef.sh`
- `src/lib/bag/databaseCapaciteitsExperiment.test.ts`
- `.github/workflows/bag-2a2-postgis-capaciteitsproef.yml`

## Beslismoment na uitvoering

Een geslaagde capaciteitsproef geeft uitsluitend toestemming om de volgende subbuild te ontwerpen: een streamingexport van de echte officiële Assen-records naar het geïsoleerde experimentschema.

Een geslaagde proef geeft nog geen toestemming voor een Supabase-migratie of productie-import.
