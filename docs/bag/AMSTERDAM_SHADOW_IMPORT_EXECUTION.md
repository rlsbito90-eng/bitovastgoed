# Amsterdam shadowimport — uitvoercontract

Deze BUILD maakt de feitelijke Amsterdam-import uitvoerbaar en controleerbaar, maar voert hem nog niet uit.

## Gevalideerde importpakketmijlpaal

De streaming-herstelrun `31116347259` heeft op commit `8acc02f4049e9e38123642b39984c82e3d0516ee` een inhoudelijk geldig Amsterdam-importpakket met besluit `GO` gepubliceerd.

Vastgelegde tellingen:

- closure geselecteerd: `3.037.017` records;
- InOnderzoek-nevenlevering: `372.120` records;
- importeerbare objectrecords: `2.664.897`;
- ontvangen: `2.664.897`;
- verwerkt: `2.664.897`;
- unieke objecten: `1.464.429`;
- voorkomens: `2.664.897`;
- relaties: `2.531.300`;
- geometrieën: `1.831.720`;
- adapterfouten: `0`;
- stagingfouten: `0`;
- ontbrekende geometriekoppelingen: `0`;
- ambigue geometriekoppelingen: `0`.

Het gepubliceerde artifact heeft ID `8973886061` en naam `bag-amsterdam-hersteld-importpakket-streaming`.

Dit GO-besluit betekent uitsluitend dat het importpakket inhoudelijk importgereed is. Het is geen toestemming voor een database-import, Supabase-write, publicatie of activatie.

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
- CRM-shadowproject `wzkhmjuasyuvzhhycnym` blijft buiten scope;
- validatie-SQL is read-only;
- Kadaster- en eigenaaronderzoek blijven handmatig;
- geen import, SQL, Edge Function, Supabase-wijziging of activatie zonder afzonderlijke expliciete toestemming.

## Go/no-go vóór uitvoering

De bron- en importpakketcontrole is groen. De feitelijke shadowimport blijft geblokkeerd totdat afzonderlijk en aantoonbaar is voldaan aan alle volgende voorwaarden:

1. de actuele capaciteit en vrije ruimte van uitsluitend shadowproject `xfygspvpeugxowxbcvnm` zijn read-only bevestigd;
2. de rollbackprocedure en rollbackmarker zijn vooraf vastgelegd en getest;
3. het exacte importcommando, de tranchevolgorde en de hervatstrategie zijn gereviewd;
4. is bewezen dat credentials en projectreferenties uitsluitend naar het toegestane shadowproject wijzen;
5. de gebruiker heeft expliciet toestemming gegeven voor de concrete importhandeling;
6. publicatie en allowlist-activatie blijven daarna nog afzonderlijk geblokkeerd.

Tot dat moment is de toegestane status: `importpakket_go_import_niet_geautoriseerd`.
