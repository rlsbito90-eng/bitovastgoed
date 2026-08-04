# Object-ID mutatiepakket — goedkeuringspoort

Deze poort beoordeelt uitsluitend of een eerder opgebouwd dry-runpakket klaar is voor menselijke beoordeling.

## Verplicht

- stabiel pakket-ID;
- SHA-256 pakket-hash;
- expliciete reviewer;
- goedkeurings- en vervalmoment;
- uitsluitend shadowomgeving;
- geen handmatige-beoordelingsvoorstellen in het mutatiescope;
- nul writes en nul automatische merges.

## Belangrijk

`approval_ready` verleent nog geen toestemming om een databasebackfill uit te voeren. Ook dan blijven `mutationAllowed = false` en `writes = 0`. Een latere uitvoerings-BUILD vereist een afzonderlijke expliciete autorisatie, shadow-scope, transactiegrenzen, audittrail en rollbackcontrole.
