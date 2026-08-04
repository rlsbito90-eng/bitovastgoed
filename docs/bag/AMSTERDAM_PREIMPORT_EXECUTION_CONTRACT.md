# Amsterdam BAG pre-import uitvoercontract

Deze BUILD maakt de stap tussen bronpakketacceptatie en de feitelijke shadowimport reproduceerbaar.

## Vastgelegd

- deterministische tranches op basis van objecttelling;
- standaard tranchegrootte van 100.000 objecten;
- hervatten vanaf de eerste niet-afgeronde tranche;
- vaste pre-publicatie rollbackmarker per datasetversie;
- client- en serverallowlists blijven tijdens import geblokkeerd;
- machineleesbaar validatierapport voor bron, tranches, integriteit, rollback en publicatiestatus.

## Publicatiepoort

Amsterdam mag pas `publicatieToegestaan=true` krijgen wanneer:

1. het officiële bronpakket geldig is;
2. alle tranches zijn afgerond;
3. integriteitsvalidatie is geslaagd;
4. geen rollback actief is;
5. de fase `publicatie_gereed` is;
6. de allowlists nog geblokkeerd zijn.

Activatie van scope `0363` blijft een afzonderlijke handeling ná acceptatie. Deze BUILD importeert geen data en wijzigt Supabase niet.
