# Vastgoedrekenen — taxonomie Fase 1

Deze fase introduceert uitsluitend een toekomstige canonieke taxonomielaag voor scenario’s.

## Doel

De bestaande gecombineerde strategiecodes kunnen later worden ontvlochten naar onafhankelijke dimensies:

1. businesscase;
2. fysieke ingreep;
3. uitbreidingstype;
4. exploitatievorm;
5. disposition;
6. componenttiming;
7. waarderingsmethode.

## Belangrijke modelkeuzes

- Een Quickscan blijft voorlopig ongewijzigd.
- De bestaande velden `main_strategy`, `proposition_type`, `strategy_type` en `sale_strategy` blijven leidend.
- Businesscase en exit zijn onafhankelijke dimensies.
- `Uitbreiden` is een ingreep; `Optoppen` is daarvan een subtype.
- Deels aanhouden en deels verkopen wordt later per component vastgelegd.
- `dcf_unlevered` is alleen als toekomstige waarderingscode gereserveerd en nog niet aangesloten.

## Buiten scope

- databasevelden en migraties;
- UI en dropdowns;
- automatische conversie van bestaande scenario’s;
- financiële rekenlogica;
- DCF-berekeningen;
- financieringsmodellen;
- comparatieve waardering;
- Kadaster.

De legacy-mapping is adviserend, expliciet voorzien van betrouwbaarheid en waarschuwingen en schrijft niets terug.