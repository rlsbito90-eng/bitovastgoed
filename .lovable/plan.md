
# Prompt 3.5 — Matchinglogica gecentraliseerd (afgerond)

- Sterke-match drempel centraal: `STRONG_MATCH_THRESHOLD = 70` (0–100 schaal) in `src/lib/derivations/matching.ts`.
- `isStrongMatch(score)` gebruikt in: `MatchAlertBadge`, `NotificationsBell`, `DashboardPage` (top kandidaten), `ObjectDetailPage` (sterke matches), `StatusBadges.MatchScoreBadge`.
- Kandidaten-teller via `countKandidaten({ matches, pipelineRows, threshold })` in `src/lib/derivations/deal.ts` — telt unieke relaties uit matches ∪ pipeline, geen dubbeltelling.
- Top kandidaten en kandidaten-in-traject blijven inhoudelijk gescheiden.
- NotificationsBell init markeert bestaande matches als gezien → geen overload.
- Geen schema-/datawijziging; legacy taxonomie-fallback ongemoeid (cleanup later in 3.8/3.9).
- Tests: `src/test/derivations/matching.test.ts` + `src/test/derivations/deal.test.ts`.

# Prompt 3.6 — Dealflow/pipeline/biedingen/cockpit gecentraliseerd (afgerond)

Bron van waarheid per domein:
- **Top kandidaten / matches** → `getMatchesForObjectFromData` + `isStrongMatch` (≥70).
- **Kandidaten in traject** → `object_pipeline` rows via `getPipelineVoorObject` / `getActivePipelineCandidates`.
- **Kandidaatcount (hoofdteller)** → `countKandidaten({ matches, pipelineRows, objectId })` — unieke union, geen dubbeltelling.
- **Lead deal** → `selectLeadDeal(deals, objectId)` (actief > hoogste FASE_KANS > recentste contact).
- **Verwachte fee (gewogen)** → `calculateExpectedFee(deals)` = Σ commissieBedrag × FASE_KANS, alleen actieve fases.
- **Potentiële commissie** → `deal.commissieBedrag` ongewogen (apart label in cockpit).
- **Dealflowfase** → object pipeline / deal.fase (bestaande logica ongemoeid).
- **Biedingen** → biedingen-module/tabel (`useBiedingen`), notificatie-verloop uit dezelfde bron.
- **Deal Cockpit** → samenvatting via bovenstaande selectors, geen eigen logica.

Wijzigingen:
- `ObjectDetailPage`: lokale lead-deal-sortering vervangen door `selectLeadDeal`.
- Cockpit toont nu expliciet "Verwachte fee (gewogen)" + "Potentiële commissie" — geen verwarring meer.
- `DashboardPage` / `DealsPage` / `DealDetailPage` / `DealFormDialog` blijven `FASE_KANS` direct gebruiken (consistent met `calculateExpectedFee`).

Geen schema-/datamigratie. Geen records verwijderd/overschreven.

Open punten (later):
- `DashboardPage` zou `calculateExpectedFee` rechtstreeks kunnen aanroepen i.p.v. `commissieStats.pipelineBedragGewogen` (semantisch identiek, cosmetische refactor).
- Bieding-verloop notificaties centraliseren in `src/lib/biedingen` helper (3.7+).



# Componentstrategie per scenario

Doel: per scenario kunnen kiezen wat er met elke component/unit gebeurt (verkopen, aanhouden, renoveren, splitsen, transformeren, handmatig, later beslissen) en de scenariowaarde + maximale aankoopprijs samenstellen uit deze mix. Geïntegreerd binnen de bestaande `computeScenario`-engine.

## 1. Datamigratie — uitbreiden `sell_off_units`

Toegevoegd via migration (geen rename — UI noemt het "Componentstrategie"):

- `component_id uuid` (optioneel, voor import-link naar `calculation_components`)
- `unit_label text`, `unit_type text`, `surface_gbo numeric`, `surface_vvo numeric`, `surface_bvo numeric`
- `strategy text` (nieuwe enum-achtige tekstkolom) met values:
  `verkopen_leeg | verkopen_verhuurd | aanhouden | renoveren_verkopen | renoveren_aanhouden | splitsen_verkopen | transformeren_verkopen | transformeren_aanhouden | handmatige_waarde | later_beslissen`
- Verkoop: `sale_price_total bigint`, `sale_price_per_m2 numeric`, `sale_price_source text`, `sale_costs_pct numeric`, `sale_costs_amount bigint`, `legal_costs bigint`, `renovation_costs bigint`, `splitting_costs bigint`, `transformation_costs bigint`, `net_sale_proceeds bigint`
- Aanhouden: `hold_monthly_rent bigint`, `hold_annual_rent bigint`, `hold_rent_source text`, `hold_valuation_method text`, `hold_bar numeric`, `hold_nar numeric`, `hold_factor numeric`, `hold_value_manual bigint`, `hold_value_calculated bigint`
- Algemeen: `contribution_to_scenario_value bigint`, `notes text`, `sort_order int default 0`

Bestaande rijen blijven werken (alle nieuwe kolommen nullable). RLS-policies blijven gelijk aan huidige `sell_off_units`.

## 2. Centrale rekenlogica

Nieuwe pure module `src/lib/vastgoedrekenen/componentStrategy.ts`:

- `computeComponentStrategy(unit, scenarioCtx)` → `{ contribution, breakdown, warnings }`.
  - Verkoopvarianten → bruto verkoopwaarde (`per_m2` of `totaal`) min verkoopkosten, juridisch, renovatie, splitsing, transformatie.
  - Aanhouden-varianten → waarde via BAR / NAR / factor / handmatig op gekozen huurbron (huidig / markt / wws-gecorrigeerd / handmatig).
  - `handmatige_waarde` → manual value.
  - `later_beslissen` → 0 + warning.
- `aggregateStrategy(units)` → totalen voor: behoudwaarde, netto verkoopopbrengst, extra kosten die niet al in opbrengst zaten, strategy-mix tekst.

`computeScenario` (`compute.ts`) uitgebreid:

- Accepteert `strategyUnits: SellOffUnit[]` in `ComputeContext`.
- Als er units zijn:
  - `scenarioWaarde = behoudwaarde + nettoVerkoopopbrengstUnits`
  - `totalInvestment` voegt component-renovatie/splits/transformatiekosten toe (alleen voor *aanhouden*-varianten — verkoopkosten worden al in netto opbrengst verwerkt).
  - `maxAankoopprijs = scenarioWaarde − OVB − aankoopkosten − scenariobrede kosten − financiering − safetyMargin − gewenste marge`. OVB wordt iteratief opgelost via bestaande OVB-helper (2 passes) i.p.v. hardcoded %.
  - `scenarioResultaatBijVraagprijs = scenarioWaarde − totalInvestment(asking)`.
- Resultaten toegevoegd aan `ComputedOutputs`: `strategyEnabled`, `strategyMix`, `holdValue`, `saleNetProceedsUnits`, `scenarioValue`, `scenarioResultAtAsking`, `scenarioMarginPct`, `maxPurchasePrice`, `roundsAtAsking`.
- Wanneer geen units → bestaande gedraging ongewijzigd (backwards compatible).

## 3. UI binnen ScenarioEditor

Nieuwe sectie **Componentstrategie** (boven of na "Componenten"):

- Knoppen: *Importeer uit componenten*, *Maak hybride scenario (woningen verkopen, commercieel houden)*, *Unit toevoegen*.
- Tabel per unit: naam, type, m², strategie (select), huur/verkoopwaarde, kosten, bijdrage, waarschuwing.
- Per rij detail-paneel met alleen de relevante velden afhankelijk van strategie.
- Bovenaan scenario een mini-samenvatting: strategie-mix, behoudwaarde, netto verkoopopbrengst, scenariowaarde, max aankoopprijs, verschil vraagprijs, rond te rekenen ja/nee.

Mapping import (componenttype → strategie):
- `woning`/`appartement` → `verkopen_leeg`
- `winkel`/`kantoor`/`bedrijfsruimte` → `aanhouden`
- overig → `later_beslissen`

Hybride knop overschrijft alleen units waar strategie nog `later_beslissen` of leeg is (geen data verlies).

## 4. ScenarioVergelijking & DealSnapshot

Beide componenten lezen de nieuwe `ComputedOutputs`-velden en tonen extra rijen: strategie-mix, behoudwaarde, netto verkoopopbrengst, scenariowaarde, scenarioresultaat, marge %, max aankoopprijs, verschil vraagprijs, rond te rekenen.

Wanneer `strategyEnabled = false` blijven huidige weergaves ongewijzigd.

## 5. Hook & data fetch

`useScenarioChildren` haalt al `sellOffUnits` op — alleen CRUD-helpers toevoegen (`createUnit`, `updateUnit`, `deleteUnit`, `importFromComponents(componentIds)`, `applyHybridPreset()`).

## 6. Validatie

Centraal in `componentStrategy.ts` per unit:
- ontbrekende strategie, verkoopwaarde, huur, BAR/NAR/factor, WWS, verkoop-/splits-/transformatiekosten, handmatige waarde zonder toelichting, "later beslissen" telt niet mee.

Warnings worden opgeteld bij `ComputedOutputs.warnings`.

## 7. Tests

Nieuwe unit tests `src/test/vastgoedrekenen/componentStrategy.test.ts`:
- per strategie de berekening,
- aggregaten,
- `computeScenario` met units (Hinthamerstraat-case): 6 woningen verkoop + 2 winkels aanhouden → max aankoopprijs vs vraagprijs €2.300.000.

## Buiten scope

Bouwkostenbibliotheek, PDF/CSV-export, WWS V2.

## Bestanden

- migration (nieuwe kolommen op `sell_off_units`)
- `src/lib/vastgoedrekenen/componentStrategy.ts` (nieuw)
- `src/lib/vastgoedrekenen/compute.ts` (uitgebreid)
- `src/lib/vastgoedrekenen/types.ts` (uitgebreid)
- `src/hooks/useVastgoedrekenen.tsx` (CRUD helpers)
- `src/components/vastgoedrekenen/ScenarioEditor.tsx` (UI-sectie)
- `src/components/vastgoedrekenen/ComponentStrategyTable.tsx` (nieuw)
- `src/components/vastgoedrekenen/ScenarioVergelijking.tsx` (uitbreidingen)
- `src/components/vastgoedrekenen/DealSnapshot.tsx` (uitbreidingen)
- `src/test/vastgoedrekenen/componentStrategy.test.ts` (nieuw)

Werkvolgorde: migration → types/engine → tests → UI → vergelijking/snapshot.
