# Vastgoedrekenen — taxonomie Fase 2: additieve opslag

## Doel

Fase 2 maakt het mogelijk om de canonieke scenario-taxonomie en de scope van een Quickscan op te slaan zonder de bestaande strategievelden te vervangen.

## Quickscan-niveau

`real_estate_calculations` krijgt nullable metadata:

- `analysis_question`: de centrale analysevraag;
- `valuation_date`: de peildatum;
- `time_horizon_months`: de beschouwde periode in maanden.

Deze velden zijn metadata. Ze worden nog niet automatisch gebruikt in waarderings-, DCF- of financieringsformules.

## Scenario-niveau

`calculation_scenarios` krijgt nullable canonieke velden:

- `business_case`;
- `intervention`;
- `expansion_subtype`;
- `exploitation_mode`;
- `disposition`;
- `taxonomy_schema_version`.

De bestaande velden `strategy_type` en `sale_strategy` blijven ongewijzigd aanwezig en blijven voor de huidige UI en rekenkern leidend.

## Atomair opslagcontract

Een canonieke classificatie wordt volledig opgeslagen met een positieve `taxonomy_schema_version`, of alle canonieke velden blijven null. Hierdoor ontstaat geen half gemigreerd scenario.

`expansion_subtype` is uitsluitend toegestaan wanneer `intervention = 'expand'`.

## Dual-read

De centrale resolver hanteert deze volgorde:

1. volledig, gemarkeerd canoniek record;
2. bij inconsistente historische data: geldige canonieke velden met veilige legacyfallback per ontbrekend veld;
3. zonder canonieke opslag: volledige interpretatie via `strategy_type`.

Dual-read is uitsluitend read-only. Er vindt geen automatische write of backfill plaats.

## Bewust buiten scope

- geen automatische conversie van bestaande Quickscans of scenario’s;
- geen verwijdering of wijziging van oude dropdowns;
- geen UI voor de nieuwe velden;
- geen wijziging aan `computeScenario()`;
- geen DCF- of financieringsmodel;
- geen wijziging aan comparatieve waardering;
- geen productie-deploy of database-uitvoering als onderdeel van de code-merge.

## Volgende fase

Een afzonderlijke UI-fase kan de nieuwe metadata en taxonomie expliciet laten kiezen. Pas nadat die flow is gevalideerd, kan per scherm worden overgeschakeld van legacy-read naar canonieke read en kunnen oude keuzelijsten gecontroleerd worden uitgefaseerd.
