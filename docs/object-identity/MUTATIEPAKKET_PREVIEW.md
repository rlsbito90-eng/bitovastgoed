# Object-ID mutatiepakket-preview

## Doel

Bouw toekomstige centrale Object-ID-mutaties eerst op als volledig controleerbaar dry-runpakket. Deze stap voert niets uit en verleent geen mutatierecht.

## Regels

- elk voorstel heeft een stabiel brontype en bron-ID;
- per bronrecord bestaat maximaal één voorstel;
- koppelen aan een bestaand centraal object vereist een doelobject-ID;
- een nieuw-objectvoorstel mag nog geen doelobject-ID hebben;
- ieder niet-handmatig voorstel vereist een geldige BAG-verblijfsobject-ID of BAG-pand-ID;
- BAG-ID's bevatten exact zestien cijfers;
- adres-only gevallen blijven handmatige beoordeling;
- dubbele of inconsistente voorstellen blokkeren het volledige pakket.

## Uitvoer

De preview rapporteert aantallen voor:

- koppelen aan bestaand centraal object;
- nieuw centraal object voorstellen;
- handmatige beoordeling;
- blokkerende redenen.

De veiligheidsgrens is hard:

```text
mutationAllowed = false
writes = 0
automaticMerges = 0
```

Een status `preview_ready` betekent uitsluitend dat het voorstelpakket intern consistent is en beoordeeld kan worden. Het betekent niet dat databasewrites zijn toegestaan.
