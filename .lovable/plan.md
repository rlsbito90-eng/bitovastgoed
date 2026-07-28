## Diagnose Vastgoedrekenen-informatiearchitectuur (read-only, geen code/DB gewijzigd)

### 1. Geverifieerde inventarisatie

**Database (public):**
- `real_estate_calculations` (analyse/quickscan-container): `object_id, calculation_name, status, main_strategy, object_type, input_reliability, notes, proposition_type, proposition_schema_version`. **Geen** analysevraag, peildatum of tijdshorizon.
- `calculation_scenarios` (78 kolommen) bevat door elkaar: `strategy_type` (enum `vr_strategy_type`, 17 waarden), `sale_strategy`, `leading_valuation_track`, `bid_basis`, `ovb_mode`/`ovb_classification`, `rent_choice`, `wws_mode_default`, kosten, targets, `financing_costs`, `project_duration_months`, `renovation_area_m2`, `temporary_project_income(_costs)`.
- `calculation_components` = fysiek/verhuurprogramma; `sell_off_units` = componentstrategie met eigen `strategy`, `hold_valuation_method`, `hold_bar/nar/factor`, `expected_sale_period_months`, `sort_order`.
- `exit_assumptions` (`exit_type, exit_year, exit_factor, exit_yield, ...`), `scenario_costs`, `calculation_outputs` (platte KPI-snapshot).
- `comparative_valuations` + `comparative_valuation_references` (recent gebouwd, method/basis/purpose + referentiecorrecties). Volledig intact te houden.

**Code:**
- Rekenkern: `src/lib/vastgoedrekenen/compute.ts` (659 r.), `componentStrategy.ts`, `residueel.ts`, `verkoop.ts`, `investering.ts`, `ovb.ts`, `huur.ts`, `sensitivity.ts`, `comparativeValuation.ts`.
- Taxonomie op drie plekken: `propositions/types.ts` + `definitions.ts` (13 `PropositionType`, 6 `InterventionType`, 5 `DispositionType`, 13 `ValuationMethodId`), `componentStrategy.ts` (12 gecombineerde `ComponentStrategyKey`s), enum `vr_strategy_type` in de database (17 gecombineerde waarden). Plus `propositions/legacyStrategyAdapter.ts` als vertaallaag.
- UI: `ScenarioEditor.tsx` (2119 r., ~97 select-elementen), `ComponentStrategyTable.tsx`, `RekenbasisBar.tsx`, `CockpitHeader.tsx`, `AnalysisPropositionSettings.tsx`, `ScenarioVergelijking.tsx`, `SensitivityAnalysis.tsx`, `ComparativeValuationPanel.tsx`.

**DCF/financiering — expliciet gecontroleerd:** er is **geen** DCF, cashflowreeks, IRR, NPV/NCW, discontering, WACC, lening, rente, aflossing, LTV/LTC of levered/unlevered logica in `src/` of `supabase/`. Financiering bestaat uitsluitend als één statisch bedrag `calculation_scenarios.financing_costs`, gebruikt in `compute.ts:145`, `outcomeExplanation.ts:183/239`, `audit/maxBidExplain.ts:43`, `audit/calcChain.ts:132`. Tijd bestaat alleen als losse doorlooptijden (`project_duration_months`, `expected_sale_period_months`, `exit_year`) zonder periodemodel.

### 2. Begrippen op het verkeerde niveau
- **Propositietype** mengt businesscase (`leased_investment`, `renovate_and_sell`), fysieke ingreep (`demolition_newbuild`, `rooftop_extension`), objectsamenstelling (`mixed_use`, `portfolio`) en sector (`leased_hotel`, `operating_hotel`).
- **Optoppen** staat als hoofdpropositietype én als interventie; hoort uitsluitend als expansion-subtype.
- **`strategy_type` (scenario)**, **`main_strategy` (analyse)** en **`sell_off_units.strategy`** overlappen; alle drie combineren ingreep + disposition in één waarde (`transformeren_verkopen` enz.).
- **Gemengd aanhouden/verkopen** is nu impliciet via componentstrategieën, maar wordt op scenarioniveau nog gedwongen in één `strategy_type`.
- **Waarderingsmethode** zit verspreid over `leading_valuation_track`, `bid_basis`, `hold_valuation_method` en `comparative_valuations.method`.
- **Timing** is per veld ad hoc, niet als dimensie per component.

### 3. Voorgestelde canonieke taxonomie (nieuw, additief)
- `business_case`: hold_investment, value_add_hold, value_add_sell, redevelop_sell, sell_off, land_development, operating_asset, portfolio_aggregation, legacy_generic.
- `intervention`: none, maintain, renovate, upgrade_sustainability, split, transform, expand, demolish_newbuild.
- `expansion_subtype` (alleen bij `expand`): rooftop_addition, extension_horizontal, new_volume_on_plot, interior_densification.
- `disposition` (per component): hold, sell_vacant, sell_tenanted, sell_unit, refinance_hold, undecided.
- `component_timing`: `start_month`, `duration_months`, `disposition_month` per component.
- `valuation_method`: bestaande `ValuationMethodId`-lijst blijft leidend, aangevuld met `comparative_market` als expliciet spoor (bestaat al) en `dcf_unlevered`.
- Analyse-niveau krijgt: `analysis_question`, `valuation_date` (peildatum), `horizon_months`.

### 4. Plaats van DCF en financiering
- DCF wordt een aparte, afgeleide laag boven de bestaande kern: `src/lib/vastgoedrekenen/dcf/` produceert een periodereeks uit component-timing, exploitatie en disposities. `computeScenario()` blijft ongewijzigd en levert de statische kern.
- Unlevered resultaat (NCW, IRR, equity multiple) uitsluitend uit de vastgoedcashflow.
- Financiering als losse laag `financing/` met eigen dataset (hoofdsom, LTV/LTC, rente, aflosvorm, looptijd, afsluitkosten) die op de unlevered reeks wordt geprojecteerd → levered IRR, cash-on-cash, DSCR. Beide altijd naast elkaar getoond; `financing_costs` blijft als legacy-bedrag geldig zolang geen financieringsobject bestaat.

### 5. Datamigratiestrategie zonder dataverlies
- Alleen nieuwe, nullable kolommen/tabellen; geen enumwaarden verwijderen of hernoemen.
- Nieuwe velden `business_case`, `intervention`, `expansion_subtype` naast bestaande `strategy_type`; `strategy_type` blijft leidend tot een scenario expliciet is gemigreerd (`taxonomy_version`).
- Deterministische mapping in code (uitbreiding van `legacyStrategyAdapter.ts`), geen automatische DB-conversie. Migratie per scenario, met preview, waarschuwing en `taxonomy_version` terugzetten als rollback.
- Bestaande outputs en golden tests moeten byte-voor-byte gelijk blijven.

### 6. UI-ontwerp: één keuze per concept
Scenario-header krijgt een vaste keuzeketen: Businesscase → Ingreep (+ subtype bij Uitbreiden) → Waarderingsmethode → Financiering aan/uit. Componenttabel krijgt per rij: Disposition → Timing → Waarderingsmethode. Alle overlappende dropdowns (`strategy_type`, `sale_strategy`, `leading_valuation_track`, `bid_basis`) worden afgeleid weergegeven of read-only, niet dubbel bewerkbaar.

### 7. Impact comparatieve waardering
Geen inhoudelijke wijziging. `comparative_valuations` blijft een zelfstandig waarderingsspoor; het wordt alleen als expliciete `valuation_method`-optie gekoppeld en behoudt zijn eigen tests.

### 8. Gefaseerd BUILD-plan (kleine PR's)
1. **F1 – Taxonomie (code-only):** canonieke types + mappers + tests. Geen DB, geen UI. Acceptatie: alle bestaande tests groen, mapping 100% dekkend voor 17 `vr_strategy_type`-waarden.
2. **F2 – Analyse-laag:** analysevraag, peildatum, horizon op `real_estate_calculations`. Acceptatie: bestaande quickscans blijven werken met lege waarden.
3. **F3 – Scenario-dimensies:** nullable kolommen + expliciete migratieknop per scenario met preview en rollback.
4. **F4 – Componenttiming en disposition:** velden op `sell_off_units`, afgeleide `strategy` blijft bestaan.
5. **F5 – DCF unlevered:** pure module + tests, nog geen UI-besluitvorming.
6. **F6 – Financiering levered:** eigen tabel + levered KPI's naast unlevered.
7. **F7 – UI-consolidatie:** één keuze per concept, dubbele dropdowns opruimen.

### 9. Niet bouwen vóór goedkeuring
Geen enum-/kolomwijzigingen, geen conversie van bestaande scenario's, geen aanpassing van `computeScenario()` of de residuele/OVB-logica, geen verwijdering van `strategy_type`/`sale_strategy`/`leading_valuation_track`, geen wijziging aan comparatieve waardering, en geen Kadaster-aanpassingen.

### Technische details
Belangrijkste bestanden: `src/lib/vastgoedrekenen/{compute,componentStrategy,residueel,verkoop,sensitivity,comparativeValuation}.ts`, `src/lib/vastgoedrekenen/propositions/*`, `src/lib/vastgoedrekenen/analysis/*`, `src/components/vastgoedrekenen/*`. Nieuwe mappen bij BUILD: `src/lib/vastgoedrekenen/taxonomy/`, `dcf/`, `financing/`.
