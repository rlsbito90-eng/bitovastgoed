# Fase 0 — Diagnose Vastgoedrekenen 2.0

**Referentiecase:** Transformatie Den Haag (commercieel → residentieel, geen vaste vraagprijs, residuele maximale bieding gewenst).
**Scope:** uitsluitend read-only code-, data- en architectuurdiagnose. Geen wijzigingen.
**Datum:** 22 juli 2026.

---

## 1. Architectuurinventarisatie

### 1.1 Motorbestanden `src/lib/vastgoedrekenen/`

| Bestand | Regels | Rol |
| --- | ---: | --- |
| `compute.ts` | 447 | Orchestrator (single entrypoint `computeScenario`) |
| `verkoop.ts` | 186 | Exit / verkoop, `computeSale`, `exitBasedMaxBid` |
| `bieding.ts` | 40 | BAR-terugrekening naar `maxBid` |
| `investering.ts` | 149 | Aankoopkosten, kostenposten, btw-behandeling, `computeTotalInvestment` |
| `ovb.ts` | 176 | OVB (scenario, per_component, manual) |
| `huur.ts` | 58 | Bruto/gecorrigeerde jaarhuur, BAR, factor |
| `componentStrategy.ts` | 267 | Per-unit strategie, `maxPurchasePrice`-input |
| `scores.ts` | 167 | Betrouwbaarheid, risk, complexity, deal-/verkoopscore |
| `conclusie.ts` | 57 | `buildConclusion`, `buildNextStep` |
| `feasibility.ts` | 67 | "Ja / bijna / nee" t.o.v. referentiebedrag |
| `validation.ts` | 205 | `buildNogTeControleren`, `buildAannameWaarschuwingen` |
| `profiles.ts` | 151 | Aannameprofielen per vastgoedtype |
| `defaults.ts` | 104 | Fallback-tarieven en labels |
| `fees/`, `wws/`, `validation/`, `audit/` | – | Sub-modules (aankoopfee, WWS-modus, veldstatus, auditlaag) |

Zes bestaande testbestanden onder `src/test/vastgoedrekenen/` (`golden/`, `audit/`, `fees/`, `vatTreatment`, `feasibility`, `saveGuards`, `unitIdentity`), ~1.200 regels tests. Geen gespecialiseerde transformatie- of residueelbid-scenario aangetroffen.

### 1.2 UI `src/components/vastgoedrekenen/`

* `VastgoedrekenenTab.tsx` — quickscan-tabs + `QuickscanDetail`.
* `ScenarioVergelijking.tsx` — matrix; instantieert **per scenario** een verborgen `<ScenarioComputer>` die zelf `useScenarioChildren` triggert (N+1 fetch, één per scenario).
* `ScenarioEditor.tsx` (1.957 regels) — bewerking, live compute, saveflow.
* `DealSnapshot.tsx` — samenvatting per scenario.
* `cockpit/`, `audit/` — waterfall, componententabel, WWS-tabel, `AuditDialog`.

### 1.3 Datastroom

```text
DB (calculation_scenarios + child-tabellen)
      ▼   useScenarioChildren  (SELECT * per tabel, per scenario)
      ▼
computeScenario(ctx)  ── pure function ──►  ComputedOutputs (in-memory)
      ▼                                            ▼
ScenarioEditor / ScenarioVergelijking /       upsertOutput (bij Save)
DealSnapshot / AuditDialog                    ─► calculation_outputs (snapshot)
```

`computeScenario` is de **enige** rekenpad. `calculation_outputs` wordt uitsluitend **geschreven** bij `ScenarioEditor.save()`; nergens in de UI wordt het weer **gelezen** voor berekeningen (alleen `output` uit `useScenarioChildren` naar state, maar geen consumer). Daarmee is de tabel effectief een cache/legacy-snapshot en geen source of truth. `runAudit` bevat expliciet een `save-stale-output`-check die dit erkent.

## 2. Databaseschema (via `information_schema`)

### 2.1 Nieuwe observaties

* **Geen foreign keys** op `scenario_id` / `component_id` / `calculation_id` in enige VR-tabel (`calculation_scenarios`, `_components`, `_outputs`, `scenario_costs`, `sell_off_units`, `residential_wws_units`, `risk_analysis`, `exit_assumptions`). Verwijdering van een scenario is afhankelijk van app-logica → orphan-risico bij directe SQL of gedeeltelijke failures.
* **Weinig CHECK-constraints:** alleen `buyer_fee_method`, `notary_costs_method`, `notary_costs_profile`, `leading_valuation_track` en `scenario_costs.vat_treatment`. `sell_off_units.strategy` en `calculation_scenarios.sale_strategy`, `sale_price_source`, `rent_source`, `bid_basis`, `cost_structure`, `mjop_present`, `wws_mode_default` zijn ongebonden `text` → risico op typefouten die stil doorwerken.
* **Uniek:** `calculation_outputs.scenario_id` is UNIQUE — 1-op-1 met scenario.
* **Enums (USER-DEFINED):** wél voor `vr_calc_status`, `vr_strategy_type`, `vr_ovb_mode`, `vr_ovb_classification`, `vr_component_type`, `vr_input_reliability`, `vr_risk_level`, `vr_huurtype_voor_bieding`, `vr_object_type`, `vr_ovb_allocation_method`, `vr_quality_level`. Dus deels enum, deels vrije tekst — inconsistent.
* **Defaults:** OVB-fallbackpercentages en aankoopfee (2%/21%) staan zowel in DB (`calculation_scenarios`) als in code (`VR_DEFAULTS`); risico op drift wanneer één van beide gewijzigd wordt.
* **`exit_assumptions`** is een volwaardige tabel (scenario_id, exit_type, exit_year, expected_sale_value, exit_factor, exit_yield, …) maar wordt **nergens** in `src/` geïmporteerd of bevraagd behalve als type. → **Dode tabel**; verkoop/exit loopt uitsluitend via `calculation_scenarios.sale_*`-kolommen en `sell_off_units`.
* **`calculation_outputs`** mist velden die de UI wél toont: `exit_based_max_bid`, `bid_basis_used`, `scenario_value`, `hold_value`, `sale_net_proceeds_units`, `max_purchase_price`, `rounds_at_asking`, `leading_max_*`, `strategy_mix`, alle `*_per_m2`, `noi_margin`, `total_correction_pct`, `vacancy/operating/maintenance/management/other_costs_eur`, `score_label/reason/positive/attention`. Alle rapportage die uit DB moet komen (PDF, export, MCP-gateway) mist dus context.
* **Nullable:** vrijwel elk numeriek veld nullable met NULL-default (zonder 0-fallback). Compute-side is defensief (`Number(v ?? 0)`), maar bij directe SQL-aggregaties (analytics) leidt dit tot `NULL`-propagatie.
* **Geen `updated_at`-trigger:** `updated_at DEFAULT now()` staat wel gedefinieerd, maar er is geen trigger die de kolom bij `UPDATE` bijwerkt (`db-triggers` sectie: leeg). `updated_at` is dus effectief `created_at` bij insert.

### 2.2 Kolommen relevant voor Transformatie Den Haag

`calculation_scenarios` bevat volledig verkoop-blok (`sale_price_total`, `sale_price_per_m2`, `sale_sellable_m2`, `sale_costs_percentage`, `sale_other_costs`, `sale_exit_value_manual`, `sale_target_margin_amount/percentage`, `sale_target_roi_percentage`, `sale_target_exit_value`, `sale_expected_period_months`, `bid_basis`). Voldoende voor residueel-bod. `sale_expected_period_months` staat opgeslagen maar wordt in compute **niet gebruikt** (geen tijdsverdiscontering).

`sell_off_units` bevat `strategy` (vrije tekst), `hold_valuation_method` (BAR/NAR/factor/handmatige_waarde), `transformation_costs`, `renovation_costs`, `splitting_costs`, `hold_value_manual`, `hold_bar`, `hold_nar`, `hold_factor`. Dekt "transformeren en verkopen" en "transformeren en aanhouden".

## 3. Functionele dekking voor de referentiecase

| Behoefte | Ondersteund | Bijzonderheden |
| --- | --- | --- |
| Object zonder vraagprijs | Ja, maar met beperkte score-logica | `asking_price` valt terug op `objectVraagprijs` uit Financieel. Zonder waarde blijft `roundsAtAsking = null`, `leadingRoundsAtAsking = null`, en de **leading-aware score-override** (compute.ts r. 310-322) slaat over. Deal score kan dan onterecht `A/B` blijven op basis van pure huur-tak. |
| Residuele max aankoopprijs | Alleen via componentstrategie | `maxPurchasePrice` (compute.ts r. 253-263) vereist `strategy.enabled === true`. Zonder `sell_off_units` is er géén residueel-pad; enige alternatieven zijn `bid.maxBid` (BAR-tak, vereist huur) en `exitBasedMaxBidNet` (exit-tak, vereist netto verkoopopbrengst + marge/ROI-target). Voor een puur transformatie-object zonder rest-huur en zonder scenario-verkoopwaarde is een residueel bod dus alléén te reconstrueren door verplicht een componentstrategie op te tuigen. |
| Combinatie transformatie + herontwikkeling | Ja, per unit | `transformeren_verkopen` en `transformeren_aanhouden` in `componentStrategy.ts`. `extraInvestmentCosts = renovationCosts + transformationCosts` wordt opgeteld bij `totalInvestmentWithStrategy`, maar niet bij aankoopkosten of OVB-grondslag. |
| OVB na transformatie (commercieel→residentieel) | Beperkt | `computeScenarioOvb` bepaalt tarief op basis van huidige `component_type`. Er is geen mechanisme om per component een **post-transformatie classificatie** (bv. woning_belegging) te gebruiken voor de residueel-berekening. Voor Den Haag betekent dit: OVB op basis van commercieel (10,4%) terwijl exitwaarde op basis van woningen wordt berekend. |
| BAR/NAR/multiplier | Ja | `bar`, `factor`, `narTotalInvestment = NOI / totalInvestment × 100`. |
| €/m² KPI's | Ja | `purchasePricePerM2`, `askingPricePerM2`, `totalInvestmentPerM2`, `maximumBidPerM2`, `salePricePerM2`, `netSaleProceedsPerM2`, `netMarginPerM2`, `annualRentPerM2`, `noiPerM2`. Alleen op object-GBO, niet op VVO/BVO. |
| Aannameprofiel-mapping | Ja | `mapToAssumptionType` valt bij transformatiecase (`mixed_use`) altijd terug op `mixed_use` — geen "post-transformatie residentieel" profiel. |
| Marge-, ROI-, exit-targets | Ja | `computeSale` kiest strengste target (bindende: `marge_euro`/`marge_pct`/`roi`/`target_exit`). |
| Tijdswaarde / IRR / faseringen | **Nee** | `sale_expected_period_months` opgeslagen maar ongebruikt. Alle rendementen zijn statisch, single-period. Voor een 18-36 maanden durende transformatie is dat een structurele beperking. |
| Financieringsstructuur | Basis | Alleen `financing_costs` als eenmalig bedrag; geen LTV/rente/looptijd/rentedragende bouwrente. |
| Btw op bouwkosten | Ja | `vat_treatment` per post + informatieve rekening. Aandachtspunt: `handmatig` met `vat_amount_manual = 0` valt terug op `vat_percentage × subtotaal` — een bewuste €0 kan niet worden geforceerd binnen `handmatig`. |
| Onvoorzien | Ja | `unforeseen_percentage` per scenario × totalDirect. |
| Componentwaarde-grondslag | Ja | `allocation_method`: value / m2 / strategy / manual / extern. `strategy`-grondslag alleen zichtbaar wanneer per-unit contribution > 0. |

## 4. Formule- en logica-audit

### 4.1 Kritiek

1. **Sale-cash flows zonder strategie-kosten (compute.ts r. 141).** `sale = computeSale(scenario, totalInvestment, purchasePrice)` gebruikt de investering **vóór** `strategy.extraInvestmentCosts`. `sale.netMargin`, `sale.roi` en `sale.exitBasedMaxBid` negeren dus renovatie-/transformatiekosten uit `sell_off_units`. Zodra `strategy.enabled === true` én er verkoopcomponenten mét transformationCosts zijn, komen ROI/marge te hoog uit en `exitBasedMaxBidNet` te ruim.
2. **Twee parallelle exit-sporen zonder harmonisatie.** Scenario-level (`sale_price_total`, `sale_exit_value_manual`, …) en componentstrategie (`sell_off_units.strategy = verkopen_*`) kunnen tegelijk gevuld zijn. `validation.ts` waarschuwt hiervoor, maar `computeSale` en `aggregateStrategy` sommeren zonder controle. Bij mixed input is `saleNetProceedsUnits` los van `netSaleProceeds` (scenario) — geen guardrail dat dubbel telt in `scenarioValue` t.o.v. downstream rapportage.
3. **`maxPurchasePrice`-iteratie niet uitgevoerd.** De code kondigt in de commentaar "pass 1 met huidige OVB-tarief, pass 2 met aangepaste prijs" aan (compute.ts r. 245-262), maar voert alleen pass 1 uit. Bij significant afwijkende `maxPurchasePrice` versus huidige `purchase_price` klopt de gebruikte OVB-schatting niet, en circulair: `ovbPctEstimate` deelt door `purchase` — bij `purchase = 0` valt hij terug op scenario-tarief. Voor een residueel-bod (waar `purchase` per definitie nog niet bekend is) is dit zwak.
4. **Overhead-symmetrie berust op één regel** (compute.ts r. 146, 244-263 en bieding.ts r. 29). `safety_margin` zit in `totalAcquisitionCosts`, dus mag niet opnieuw in `overhead`; goed geïmplementeerd, maar `overheadExclOvb` in `maxPurchasePrice` telt `safety_margin` een tweede keer op (r. 256: `acq.totalAcquisitionCosts + … + safety_margin + …`). **Dubbeltelling van `safety_margin` in de residueel-formule.**
5. **Leading-aware score-override alleen bij `asking > 0`** (compute.ts r. 310). Bij ontbrekende vraagprijs verschijnt regulier `dealScore` gebaseerd op BAR/verkoop zonder correctie voor het leidende spoor. De cockpit toont dan een groene score terwijl "rond te rekenen" onbepaald is.
6. **`ovbPerComponent` met `allocation_method='strategy'` gebruikt `component_id`-mapping** (compute.ts r. 60-68). Werkt alleen zolang `sell_off_units.component_id` gevuld is; bij handmatig aangemaakte units zonder link krijgt de OVB-berekening `missingStrategyBasis=true` én valt de basiswaarde op 0 — geen fallback naar `allocated_component_value`.
7. **ROI-targeting is single-period.** `sale_target_roi_percentage` wordt vergeleken met `roi = netMargin / totalInvestment × 100`. Dit is projectrendement over de totale looptijd, niet geannualiseerd. Gebruikers die de ROI als jaarrendement bedoelen krijgen misleidende targets, en `sale_expected_period_months` verandert daar niets aan.
8. **Deal score-drempels vast** (`VR_DEFAULTS.dealScoreBarA/B/C` = 6,5 / 5,5 / 4,5). Niet configureerbaar per asset class, en `computeDealScore` wordt óók aangeroepen voor pure verkoopcases (waarna `computeSaleScenarioScore` overschrijft) — verspilde berekening.

### 4.2 Middelzwaar

* `pickCorrectedAnnualRent` valt bij `rent_choice='wws'` zonder units terug op `min(current, market)` (huur.ts r. 30). Positief bedoeld ("voorzichtigste"), maar in een transformatiecase waar huidige huur nog laag is en markt hoog, kán dit onder de daadwerkelijke WWS-max uitkomen zodra WWS-units later worden aangemaakt.
* `computeInputReliability` (scores.ts r. 21-33) gebruikt binaire punten zonder weging; een scenario mét WOZ en zonder marktinformatie krijgt dezelfde middel-score als andersom.
* `computeComplexity` neemt `monument_status` op WWS-units mee, maar niet op object-niveau — geen kolom `monument_status` op `objecten` gescand.
* `saleScore.attentionPoints` bevat "Bouwkosten zijn indicatief" wanneer er **één** kostenpost met `reliability_status !== 'hoog'` is; dit vuurt vrijwel altijd (default `middel`) en heeft weinig signaalwaarde.
* `computeSaleScenarioScore` beoordeelt `maximumBid >= targetPrice * 0.98` als "rond" (r. 159). Consistente 2%-tolerantie, maar `feasibility.ts` hanteert 3% + €50k. Twee verschillende toleranties in dezelfde beoordelingsketen.

### 4.3 Licht

* `computeGrossSaleProceeds` fallback-volgorde bevoordeelt `total` boven `per_m2 × m² × units`, terwijl UI-labels suggereren dat `source` bindend is; werkt correct dankzij explicit `source`, maar auto-detect-fallback kan verwarrend zijn bij gedeeltelijke input.
* `computeSaleCosts` retourneert `null` wanneer geen pct én geen absoluut bedrag — goed. `sale_costs_percentage` heeft geen default (`NULL`), dus lege input geeft "kosten ontbreken" waarschuwing.
* `factor()` en `bar()` returnen `null` bij `<= 0` — consistent.

## 5. Datastroom & bronsplitsing

* **Single-source rekenpad ✔** — `computeScenario` is uniek en pure. Elke UI-consument roept het opnieuw aan met identieke inputs.
* **Stale snapshot ⚠** — `calculation_outputs` is een write-only cache. De audit-check `save-stale-output` (runAudit.ts r. 102) bevestigt dat de opgeslagen output kan afwijken van de live output. Consumers buiten React (bv. MCP-gateway, PDF-generator, notificaties) die uit `calculation_outputs` lezen, krijgen mogelijk verouderde en onvolledige data (zie ontbrekende kolommen in §2.1).
* **N+1 fetch in vergelijking ⚠** — `ScenarioVergelijking` mount per scenario een `ScenarioComputer` die `useScenarioChildren` (6 queries) uitvoert. Bij 5 scenario's = 30 queries per render. Geen batching of gedeelde cache. Nog geen `@tanstack/react-query`-integratie in deze module.
* **Save-transactie niet atomisch** — `ScenarioEditor.save()` schrijft eerst kosten (rij voor rij), dan scenariopatch, dan `calculation_outputs`. Fouten halverwege leiden tot deels opgeslagen state (bijvoorbeeld kosten wel, output niet → snapshot loopt achter). Er is geen rollback of `Promise.all` guard.
* **DealSnapshot leest live outputs**, maar krijgt outputs als prop mee (uit ScenarioEditor's `useMemo`). Zolang de gebruiker in ScenarioEditor werkt is dit correct. Buiten die context (bv. PDF-batch of MCP-tool) bestaat DealSnapshot niet en valt men terug op `calculation_outputs` — dat mist de nodige velden.
* **Componentstrategie ↔ OVB** — `strategyValueByComponentId` map wordt vóór OVB opgebouwd (compute.ts r. 58-68), maar alleen als `strategy.perUnit` `contribution > 0` heeft. Voor `later_beslissen` en `handmatige_waarde` zonder bedrag is de OVB-grondslag dan 0.

## 6. Bestaande tests — dekking t.o.v. de referentiecase

| Testbestand | Dekking |
| --- | --- |
| `golden/compute.test.ts` | Basis fixtures (66 regels). |
| `golden/extra.test.ts` | Componentstrategie-Hinthamerstraat, aankoopfee incl./excl. btw, OVB-modi, bouwkosten/btw, WWS, betrouwbaarheid, edge cases (616 regels). Dekt gemengde strategie ruim; **geen** puur transformatie-scenario zonder vraagprijs. |
| `audit/auditConsistency.test.ts` | Comparator "rond te rekenen", NOI "n.v.t." bij verkoopcase, WWS-groepering. |
| `feasibility.test.ts` | 3%/€50k drempel. |
| `vatTreatment.test.ts` | VAT-behandeling per post. |
| `fees/*` | Bito-staffel, notarisprofielen, integratie. |
| `saveGuards.test.ts`, `unitIdentity.test.ts` | Patch-guarding, unit-identity. |

**Gaten voor Vastgoedrekenen 2.0:**
* Geen tests voor residuele max aankoopprijs zonder `asking_price`.
* Geen tests op ROI-annualisering, IRR, faseringen, tijdswaarde.
* Geen tests op safety_margin-dubbeltelling in `maxPurchasePrice` (§4.1 punt 4).
* Geen tests op OVB-classificatie na transformatie (post-transformatie residentieel).
* Geen tests op sale-strategie-kosten die bij ROI/marge over het hoofd worden gezien (§4.1 punt 1).
* Geen tests op cross-consistentie van feasibility-tolerantie (3% + €50k) versus sale-score-tolerantie (2%).

## 7. Proefpassing referentiecase Transformatie Den Haag

Aanname: object commercieel, wordt getransformeerd naar 12 woningen, geen vraagprijs, koper wil weten wat hij maximaal kan bieden zodat na transformatie een ROI van 15% overblijft.

| Stap | Uitkomst met huidige engine |
| --- | --- |
| Object opvoeren zonder `asking_price` | `s.asking_price` blijft `null`; `objectVraagprijs`-effect vult niets. `askingPricePerM2 = null`, `differenceWithAskingPrice = 0`, `roundsAtAsking = null`. |
| Componentstrategie met 12 units × `transformeren_verkopen` | `aggregateStrategy` telt netto verkoopopbrengsten en `extraInvestmentCosts = Σ transformation_costs + renovation_costs`. |
| Residueel-bod berekenen | `maxPurchasePrice = (scenarioValue − overheadExclOvb) / (1 + ovbPct/100)`. Werkt, mits `strategy.enabled`. **Bug**: `overheadExclOvb` telt `safety_margin` extra (naast wat al in `totalAcquisitionCosts` zit). Effect: `maxPurchasePrice` circa `safety_margin` euro te laag. |
| OVB | Falls back op scenario-percentage of 10,4% (niet-woning). Kloopt niet met eindsituatie (woningen 8%). Geen kolom om "post-transformatie classificatie" per component vast te leggen. |
| ROI-target 15% | `roi = netMargin / totalInvestment × 100` (projectrendement, geen annualisering). Bij looptijd 24 maanden en gewenst 15%/jaar rekent de tool 15% totaal — misleiding voor de gebruiker. |
| Sale-cash flows | `computeSale` gebruikt `totalInvestment` **zonder** `extraInvestmentCosts` → ROI/marge te hoog. Combineert met bug punt 4.1.1. |
| Score-uitkomst | Zonder `asking_price` slaat de leading-aware override over; kans op groene deal-score op basis van BAR-tak terwijl BAR niet leidend is voor deze case. |
| Dashboard | DealSnapshot toont `pricePerM2Gbo` op basis van GBO van huidige object, niet post-transformatie VVO/GBO. Voor Den Haag met 6 verdiepingen te transformeren naar woningen levert dat een onlogische €/m². |

Conclusie proefpassing: de engine kan de case in beginsel dragen via componentstrategie, maar levert getallen op met minstens één deterministische fout (safety_margin dubbel), één stille onderschatting (OVB post-transformatie), één overschatting (sale-cash flows zonder strategie-extra), en een structureel scoring-blind vlek zonder vraagprijs.

## 8. Verbeterthema's voor Vastgoedrekenen 2.0 (nog niet gebouwd)

Enkel als agenda; keuzes voor scope en volgorde volgen bij vervolgprompt.

1. **Residueel bod als first-class output**, ook zonder `asking_price` én zonder verplichte componentstrategie (huur-tak, exit-tak en strategie-tak elk met eigen residueel-formule; leading-aware override werkt ook bij `asking = 0`).
2. **Fix safety_margin-dubbeltelling** in `maxPurchasePrice` (compute.ts r. 256) + iteratieve OVB-oplossing (pass 2).
3. **Symmetrische investerings-basis voor sale-berekeningen** (verkoop.ts) — `totalInvestment` inclusief `strategy.extraInvestmentCosts` doorgeven aan `computeSale` óf `computeSaleWithStrategy` toevoegen.
4. **Tijdswaarde**: activeer `sale_expected_period_months` → geannualiseerde ROI / IRR / discountering. Voor transformatie- en herontwikkelingscases essentieel.
5. **OVB-classificatie per fase** (huidig vs. na transformatie), per component, met expliciete override.
6. **Uniforme feasibility-tolerantie** — één bron voor "rond" (feasibility.ts) i.p.v. dubbele drempels in scores.ts.
7. **`calculation_outputs` uitbreiden of vervangen** door een compleet snapshot (JSONB `computed_full`) zodat MCP/PDF/exports niet uit een uitgeklede oude tabel hoeven te lezen; overweeg abandonneren van `exit_assumptions`.
8. **Data-integriteit**: FKs met `ON DELETE CASCADE`, CHECK-constraints op `sale_strategy`, `rent_source`, `bid_basis`, `sale_price_source`, `sell_off_units.strategy`, en een `updated_at`-trigger.
9. **N+1 fetch in ScenarioVergelijking** vervangen door één batchquery (`.in('scenario_id', ids)`) of react-query gedeelde cache.
10. **Save-atomiciteit**: kostenposten + scenariopatch + `calculation_outputs` in één RPC/edge-function, of tenminste rollback bij fout.
11. **Testset uitbreiden** met transformatiecase (Den Haag), residueel bod zonder asking, safety_margin-guard, OVB-post-transformatie, ROI-annualisering, cross-consistentie feasibility ↔ sale-score.
12. **Aannameprofielen post-transformatie**: `mapToAssumptionType` uitbreiden zodat eindsituatie meegewogen wordt (bv. residentieel-profiel voor exit-fase).

## 9. Wat expliciet **niet** in deze fase gecontroleerd is

* Runtime-gedrag in productiebrowser (geen Playwright uitgevoerd).
* Kwaliteit van individuele PDF-rapportage-branches (buiten scope — separate diagnose).
* Impact-analyse op bestaande data (aantal scenario's dat door §4.1-bugs geraakt is).
* Migratie-paden of backfill van `calculation_outputs`.
* WWS-modus-details (`src/lib/vastgoedrekenen/wws/`) — enkel aanwezigheid getoetst, geen formule-audit.

---

**Status:** fase 0 afgerond, geen codewijzigingen. Klaar voor go/no-go beslissing over scope van Vastgoedrekenen 2.0.
