# Amsterdam shadowimport — uitvoercontract

Deze BUILD maakt de feitelijke Amsterdam-import uitvoerbaar en controleerbaar, maar voert hem nog niet uit.

## Volgorde

1. bronpakket en checksums valideren;
2. capaciteit en vrije ruimte controleren;
3. rollbackmarker vastleggen;
4. staging gecontroleerd voorbereiden;
5. objecten, voorkomens, relaties en geometrieën per tranche importeren;
6. integriteit en quarantaine controleren;
7. queryservice-rooktest uitvoeren;
8. publicatiebesluit vastleggen;
9. pas daarna client- en serverallowlists afzonderlijk activeren.

## Harde grenzen

- uitsluitend scope `0363`;
- uitsluitend shadowproject `xfygspvpeugxowxbcvnm`;
- maximaal één importstap tegelijk;
- geen destructieve stap zonder rollbackmarker;
- Amsterdam blijft tijdens de volledige import niet-querybaar;
- productie-CRM-project `ljudxyrqoifhfikueric` blijft buiten scope;
- validatie-SQL is read-only;
- Kadaster- en eigenaaronderzoek blijven handmatig.

## Go/no-go vóór uitvoering

De import mag pas starten wanneer het officiële bronpakket lokaal beschikbaar is, alle checksums zijn vastgelegd, de werkelijke tellingen bekend zijn, voldoende shadowcapaciteit is bevestigd en de rollbackprocedure aantoonbaar is getest.
