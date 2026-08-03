# BAG BUILD 2A.1-K — Kwaliteits- en release-gates

Deze gates bepalen of een dry-run technisch geschikt is om later als basis voor een database-import te dienen. Ze publiceren niets.

## Harde blokkades

- onverwachte datasetversie;
- ontbrekend verplicht BAG-objecttype;
- ontvangen en verwerkt aantal sluiten niet;
- foutpercentage boven de ingestelde grens;
- relatiedekking onder de ingestelde grens;
- volledig ontbrekende geometrieën wanneer geometrie verplicht is;
- afwijzingen zonder één-op-één foutverantwoording;
- een niet-voltooide, nog hervatbare dry-run.

## Meetwaarden

Het resultaat bevat foutpercentage, relatiedekking en ontbrekende objecttypen. Waarschuwingen worden apart gehouden en kunnen de menselijke beoordeling ondersteunen zonder een harde blokkade te verbergen.

## Veiligheidsgrens

Het slagen van deze gates geeft geen automatische toestemming voor databasewijzigingen of publicatie. Daarvoor blijven een afzonderlijk database-importontwerp, migratiereview en expliciete go/no-go nodig.
