# BAG BUILD 2A.1-J — Integrale Assen-dry-run

De integrale dry-run verbindt de officiële adapterrecords met het stagingmodel en het dry-runrapport.

## Keten

`officieel adapterrecord → importbatch → stagingmodel → tellingen → fingerprint`

## Eigenschappen

- batchgrootte verandert de inhoudelijke uitkomst niet;
- alle voorkomens blijven beschikbaar;
- object-, relatie- en geometrieaantallen worden afzonderlijk gerapporteerd;
- stagingfouten worden expliciet opgenomen;
- er vindt geen databasewrite of publicatie plaats.

## Beperking

De TypeScript-orchestrator is met gerichte records afgedekt. Een volledige uitvoering over alle XML-bestanden uit het officiële Assen-proefpakket vereist een nieuwe read-only GitHub Actions-run waarin de bestanden aan deze keten worden aangeboden.
