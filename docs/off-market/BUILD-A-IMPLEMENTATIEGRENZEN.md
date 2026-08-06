# BUILD A — Implementatiegrenzen

## Doel

BUILD A implementeert de productiekern voor de dagelijkse acquisitieproductieflow, conform PLAN A.

## Eerst toegestane werkzaamheden

- additieve migratiebestanden ontwerpen;
- databasecontracten en TypeScript-typen toevoegen;
- atomische nummeruitgifte ontwerpen en testen;
- brief- en batchstatuscontracten toevoegen;
- migratie-, integriteits-, concurrency- en pariteitstests toevoegen;
- applicatie-integratie achter een uitgeschakelde featureflag voorbereiden.

## Geblokkeerd zonder afzonderlijk expliciet akkoord

- migraties toepassen op de productie-CRM;
- backfill uitvoeren;
- bestaande briefrecords muteren;
- nummerreeksen in productie initialiseren;
- RLS- of grants in productie wijzigen;
- Storage-buckets of documentbestanden in productie wijzigen;
- de nieuwe productiekern voor gebruikers activeren;
- automatische Kadasterhandelingen;
- Lovable gebruiken.

## Implementatievolgorde

1. canonieke databaseobjecten en constraints;
2. atomische nummeruitgifte;
3. briefidentiteit en briefversies;
4. printbatch, batchbrief en batchdocument;
5. audittrail;
6. RLS- en autorisatiecontract;
7. TypeScript-domeincontracten;
8. repositories/hooks achter featureflag;
9. werkbakintegratie;
10. productiedocumenten;
11. print- en verzendregistratie;
12. zoeken;
13. regressie- en pariteitstests.

## Releasepoort

De featureflag blijft standaard uit. Productieactivatie is pas toegestaan na:

- read-only verificatie van actuele productie-DDL en RLS;
- groene migratieproef in een geïsoleerde omgeving;
- groene concurrency- en integriteitstests;
- groene typecheck en production build;
- geen nieuwe regressies bovenop de vastgelegde baseline;
- handmatige controle van de volledige dagelijkse hoofdflow;
- afzonderlijk expliciet productieakkoord.
