# Fase 0 — Diagnose Vastgoedrekenen 2.0 (PATCH 0.1)

**Referentiecase:** Transformatie Den Haag — combinatie van transformatie én sloop/nieuwbouw, zonder vraagprijs, residuele maximale bieding gewenst.
**Status document:** herzien onder Patch 0.1. Uitsluitend read-only. Geen productiecode, database of migratie gewijzigd. Fase 1 is niet gestart.
**Peildatum:** 23 juli 2026.

---

## 1. Scope, bronnen en onderzoeksmethode

**Scope.** Read-only diagnose van de bestaande Vastgoedrekenen-module (`src/lib/vastgoedrekenen/`, `src/components/vastgoedrekenen/`, `src/hooks/useVastgoedrekenen*.tsx`, `src/test/vastgoedrekenen/`) en het bijbehorende databaseschema (`calculation_scenarios`, `calculation_components`, `calculation_outputs`, `scenario_costs`, `sell_off_units`, `residential_wws_units`, `risk_analysis`, `exit_assumptions`). Doel: vaststellen of de referentiecase Transformatie Den Haag verantwoord doorgerekend kan worden en welke minimale bouwscope Fase 1 behoeft.

**Bronnen.**
- Broncode (`src/`, `supabase/`).
- Databaseschema via `information_schema.columns`, `table_constraints`, `pg_trigger` (uitsluitend SELECT).
- Aanwezige testfiles onder `src/test/vastgoedrekenen/` en `src/test/biedingen/`.
- Bestaand diagnoserapport (deze v0), waarvan de technische bevindingen zijn geverifieerd en waar nodig geherclassificeerd.
- **Niet aangeleverd:** de Fakton Excel-werkboeken (A5, A8, B2, B9, B10) en het volledige Den Haag-dossier (BVO/GO-inmeting, huurcontracten, planvorming, juridische classificatie). Aannames die deze bronnen zouden vereisen worden expliciet als *onbekend* gemarkeerd.

**Methode.** Statische code-analyse, formule-tracering, schema-inventarisatie, testinventarisatie, uitvoeren van de gevonden Vastgoedrekenen-tests en `tsgo --noEmit`. Geen runtime-tests in browser, geen mutaties.

## 2. Inventarisatie van de huidige implementatie

### 2.1 Motorbestanden `src/lib/vastgoedrekenen/`

| Bestand | Regels | Rol |
| --- | ---: | --- |
| `compute.ts` | 447 | Orchestrator, single entrypoint `computeScenario` |
| `verkoop.ts` | 186 | Exit / verkoop, `computeSale`, `exitBasedMaxBid` |
| `bieding.ts` | 40 | BAR-terugrekening naar `maxBid` |
| `investering.ts` | 149 | Aankoopkosten, kostenposten, btw, `computeTotalInvestment` |
| `ovb.ts` | 176 | OVB (scenario / per_component / manual) |
| `huur.ts` | 58 | Bruto- en gecorrigeerde jaarhuur, BAR |
| `componentStrategy.ts` | 267 | Per-unit strategie, `maxPurchasePrice`-input |
| `scores.ts` | 167 | Betrouwbaarheid, risk, complexity, deal-/verkoopscore |
| `conclusie.ts` | 57 | `buildConclusion`, `buildNextStep` |
| `feasibility.ts` | 67 | "Ja / bijna / nee"-oordeel t.o.v. referentiebedrag |
| `validation.ts` | 205 | `buildNogTeControleren`, aannamewaarschuwingen |
| `profiles.ts` | 151 | Aannameprofielen per vastgoedtype |
| `defaults.ts` | 104 | Fallback-tarieven en labels |
| `fees/`, `wws/`, `validation/`, `audit/` | – | Aankoopfee-staffels, WWS-modus, veldstatus, auditlaag |

### 2.2 UI `src/components/vastgoedrekenen/`

- `VastgoedrekenenTab.tsx` — quickscan-tabs en `QuickscanDetail`.
- `ScenarioEditor.tsx` (±1.957 regels) — bewerking, live compute, saveflow.
- `ScenarioVergelijking.tsx` — matrix; mount per scenario een verborgen `ScenarioComputer` die `useScenarioChildren` afvuurt.
- `DealSnapshot.tsx` — samenvatting per scenario.
- `cockpit/`, `audit/` — waterfall, componententabel, WWS-tabel, `AuditDialog`.

### 2.3 Hooks / data-toegang

`useVastgoedrekenen`, `useScenarioChildren`, `useVastgoedrekenenPrefs`. Elke consument roept `computeScenario` opnieuw aan; de opgeslagen output in `calculation_outputs` wordt in productie nergens teruggelezen voor UI-rekenwerk.

## 3. Mapping van gevraagde naar werkelijke namen

| Gevraagde/verwachte naam | Werkelijke naam in codebase | Locatie |
| --- | --- | --- |
| `computeScenario` | `computeScenario` | `src/lib/vastgoedrekenen/compute.ts` |
| `DealSnapshot` | `DealSnapshot` (component) | `src/components/vastgoedrekenen/DealSnapshot.tsx` |
| Verkoopmodule | `computeSale`, `computeGrossSaleProceeds`, `computeSaleCosts` | `src/lib/vastgoedrekenen/verkoop.ts` |
| BAR-terugrekening | `bidFromBar` (`bieding.ts`) | `src/lib/vastgoedrekenen/bieding.ts` |
| Componentstrategie | `aggregateStrategy`, `mapUnitStrategy` | `src/lib/vastgoedrekenen/componentStrategy.ts` |
| OVB-berekening | `computeScenarioOvb`, `computeOvbPerComponent`, `resolveOvbManual` | `src/lib/vastgoedrekenen/ovb.ts` |
| Snapshot-tabel | `calculation_outputs` | database |
| Exit-assumpties (design) | `exit_assumptions` (tabel bestaat, ongebruikt in `src/`) | database |
| Gebruikte hooks | `useVastgoedrekenen`, `useScenarioChildren`, `useVastgoedrekenenPrefs` | `src/hooks/` |
| Golden-tests | `src/test/vastgoedrekenen/golden/{compute,extra,fixtures}` | tests |
| Feasibility-oordeel | `evaluateFeasibility` (`feasibility.ts`) | `src/lib/vastgoedrekenen/feasibility.ts` |

Geen aanroepen van `computeScenario` buiten `src/lib/vastgoedrekenen/`, `src/components/vastgoedrekenen/`, `src/hooks/useVastgoedrekenen*` en de bijbehorende tests aangetroffen.

## 4. Datastroom van invoer tot UI en snapshot

```text
DB (calculation_scenarios + child-tabellen)
      ▼   useScenarioChildren  (SELECT * per tabel, per scenario)
      ▼
computeScenario(ctx)  ── pure function ──►  ComputedOutputs (in-memory)
      ▼                                            ▼
ScenarioEditor / ScenarioVergelijking /       upsertOutput (bij Save)
DealSnapshot / AuditDialog                    ─► calculation_outputs (snapshot)
```

- **Single source of truth voor live rekenen:** `computeScenario`. Elke UI-consument herberekent bij render.
- **`calculation_outputs` is write-only:** de tabel wordt uitsluitend geschreven bij `ScenarioEditor.save()`. Nergens in `src/` wordt de tabel weer *gelezen* voor UI-berekeningen. `runAudit` bevat een `save-stale-output`-check die dit erkent. Externe consumenten (PDF, MCP-gateway) die uit `calculation_outputs` zouden lezen krijgen mogelijk verouderde of onvolledige data.
- **N+1 fetch in `ScenarioVergelijking`:** per scenario mount een `ScenarioComputer` die 6 child-queries afvuurt. Bij 5 scenario's ≈ 30 queries per render. Buiten scope Fase 1.
- **Save-flow niet atomisch:** kosten (rij voor rij) → scenariopatch → `calculation_outputs` worden serieel geschreven zonder rollback. Buiten scope Fase 1.

## 5. Functionele dekkingsmatrix

| Behoefte referentiecase | Ondersteund | Toelichting |
| --- | --- | --- |
| Object zonder `asking_price` | Deels | `s.asking_price` mag `null` zijn, maar `roundsAtAsking`, `leadingRoundsAtAsking` en de leading-aware score-override (compute.ts r. 310-322) worden dan niet toegepast. |
| Residueel bod als primaire output | Nee (indirect) | Alleen bereikbaar via `strategy.enabled === true` op `sell_off_units`. Zonder componentstrategie zijn `bid.maxBid` (BAR-tak, vereist huur) en `exitBasedMaxBidNet` (exit-tak, vereist netto opbrengst) de enige alternatieven. |
| Combinatie transformatie + sloop/nieuwbouw | Deels | `transformeren_verkopen`, `transformeren_aanhouden` en `nieuwbouw_verkopen`, `nieuwbouw_aanhouden` bestaan in `componentStrategy.ts` als waarden; sloop is niet als aparte kostenlijn per component gemodelleerd. |
| OVB post-transformatie | Nee | Zie hoofdstuk 6, categorie *ontbrekende functionaliteit*. |
| BAR / NAR / factor | Ja | `bar`, `factor`, `narTotalInvestment = NOI / totalInvestment × 100`. |
| €/m² KPI's | Deels | Alleen op object-GBO; geen VVO/BVO-splitsing. |
| Marge-, ROI-, exit-targets | Ja | `computeSale` kiest strengste target. |
| Tijdswaarde / IRR | Nee | `sale_expected_period_months` opgeslagen, ongebruikt. |
| Financiering | Basis | Alleen `financing_costs` als eenmalig bedrag. |
| Btw op bouwkosten | Ja | `vat_treatment` per post. |
| Bouwrente | Nee | Geen kolom / geen berekening. |
| Doelrendement op kosten (winst-op-kosten) | Deels | Via `sale_target_margin_percentage`; niet expliciet gelabeld. |
| Doelrendement op GDV (winst-op-omzet) | Deels | Alleen via omweg (marge / net proceeds). |
| Status "Indicatief" versus "Voor bieding" | Nee | Alleen `input_reliability` + `readiness` per veld; geen expliciete kop-status. |

## 6. Formule-audit

Per bevinding: bestand, functie, veld(en), rekenkundige impact, en classificatie.

**Legenda classificaties:**
`[FOUT]` bevestigde fout · `[VEREENV]` bewuste vereenvoudiging · `[MISSEND]` ontrekende functionaliteit · `[DOC-RISK]` oud prompt-/documentatierisico · `[VERIFY]` nader te verifiëren.

### 6.1 Kritiek

1. **`strategy.extraInvestmentCosts` niet doorgegeven aan `computeSale`.** — `compute.ts` r. 141: `sale = computeSale(scenario, totalInvestment, purchasePrice)`. `totalInvestment` bevat op dat moment nog geen `extraInvestmentCosts` uit `sell_off_units` (renovatie- + transformatiekosten). Gevolg: `sale.netMargin`, `sale.roi` en `sale.exitBasedMaxBid` overschatten scenario's met transformatie/renovatie. **Impact op Den Haag: direct — ROI en residueel exit-bod komen te ruim uit.** — **[FOUT]**
2. **Mogelijke dubbele aftrek van `safety_margin` in residueel bod.** — `compute.ts` r. 253-263 (`maxPurchasePrice`). `safety_margin` zit al in `totalAcquisitionCosts`; in de opsomming van `overheadExclOvb` staat `+ safety_margin` er opnieuw bij. Als deze regel effectief wordt uitgevoerd is `maxPurchasePrice` circa `safety_margin` euro te laag. **Vereist runtime-verificatie op een fixture** om te bevestigen dat er geen tussentijdse aftrek plaatsvindt die dit compenseert. — **[VERIFY]** met sterk vermoeden **[FOUT]**.
3. **Aangekondigde tweede OVB-pass niet uitgevoerd.** — `compute.ts` r. 245-262 kondigt in commentaar een 2-pass iteratie aan (pass 1 met huidige OVB-tarief, pass 2 met aangepaste prijs). Alleen pass 1 is geïmplementeerd. Circulair bij `purchase = 0` (residueel scenario): `ovbPctEstimate` deelt door `purchase` en valt terug op scenario-tarief. — **[MISSEND]** met **[DOC-RISK]** in commentaar.
4. **Deal-score-override slaat over bij ontbrekende vraagprijs.** — `compute.ts` r. 310-322 (`applyLeadingScoreOverride`) draait alleen als `asking_price > 0`. Zonder vraagprijs blijft `dealScore` op de BAR-tak steken, ook wanneer BAR niet leidend is (bij transformatie zonder rest-huur is dat regel). Cockpit toont dan een groene score terwijl "rond te rekenen" onbepaald is. — **[FOUT]** in de zin van semantische onjuistheid; kán ook als **[VEREENV]** gelezen worden, maar niet gedocumenteerd.
5. **`sale_expected_period_months` opgeslagen maar niet doorgerekend.** — Kolom bestaat op `calculation_scenarios`; `computeSale` en `computeScenario` gebruiken hem niet. ROI is single-period ("projectrendement"), niet geannualiseerd. Voor 18-36 maanden transformatie misleidend. — **[MISSEND]**.
6. **Statische ROI, geen IRR / DCF.** — Alle rendementen zijn point-in-time; geen tijdsverdiscontering, geen cash-flow-planning per periode. — **[MISSEND]** (bewust buiten scope Fase 1).
7. **Financieringsimpact op maximale bieding.** — `financing_costs` wordt als eenmalig bedrag opgeteld in de investering en overhead. Er is geen LTV/rente/looptijd/schuldendienst, en `maximumBid` wordt niet gecorrigeerd voor rentedragende cash-out. — **[VEREENV]** met risico van **[MISSEND]** voor cases met significante financiering.
8. **Bouwrente ontbreekt.** — Geen kolom, geen berekening, geen fasering. Voor transformatie/nieuwbouw met bouwperiode van meerdere maanden ontbreekt daarmee een reële kostenpost. — **[MISSEND]**.
9. **Biedingsadvies-interpolatie hanteert twee toleranties.** — `computeSaleScenarioScore` (`scores.ts` r. 159) gebruikt `maximumBid >= targetPrice * 0.98` (2%). `feasibility.ts` hanteert 3% + €50k. Twee verschillende drempels in dezelfde beoordelingsketen. — **[FOUT]** in de zin van interne inconsistentie.
10. **Parallelle scenario- en unit-exitberekeningen.** — Scenario-level velden (`sale_price_total`, `sale_exit_value_manual`) en per-unit exit (`sell_off_units.strategy = verkopen_*`) kunnen tegelijk gevuld zijn. `validation.ts` waarschuwt hiervoor, maar `computeSale` en `aggregateStrategy` sommeren zonder cross-check op dubbeltelling in `scenarioValue`. — **[FOUT]** conditioneel (alleen wanneer beide gevuld) — **[VERIFY]** in productiedata.
11. **`ovbPerComponent` met `allocation_method='strategy'`.** — `compute.ts` r. 60-68 leunt op `sell_off_units.component_id`. Handmatige units zonder link krijgen `missingStrategyBasis=true` en basiswaarde 0; er is geen fallback naar `allocated_component_value`. — **[VEREENV]** met **[FOUT]**-effect voor handmatige input.

### 6.2 Middelzwaar

- `pickCorrectedAnnualRent` valt bij `rent_choice='wws'` zonder units terug op `min(current, market)` (`huur.ts` r. 30) — **[VEREENV]**.
- `computeInputReliability` (`scores.ts` r. 21-33) gebruikt binaire punten zonder weging — **[VEREENV]**.
- `computeComplexity` neemt `monument_status` op WWS-units mee, maar niet op object-niveau — **[MISSEND]**.
- `saleScore.attentionPoints` vuurt "Bouwkosten zijn indicatief" bij één enkele kostenpost met `reliability_status !== 'hoog'`; default `middel` maakt dit vrijwel altijd waar — **[VEREENV]** met lage signaalwaarde.

### 6.3 Licht

- `computeGrossSaleProceeds` fallback-volgorde bevoordeelt `total` boven `per_m2 × m²` — **[VEREENV]**.
- `computeSaleCosts` retourneert `null` wanneer geen pct én geen bedrag ingegeven — correct.
- `factor()` en `bar()` returnen `null` bij `<= 0` — correct.

## 7. Proefpassing Transformatie Den Haag

**Vaststaand voor deze case:**
- Combinatie transformatie én sloop-nieuwbouw.
- Geen vraagprijs; bieding moet residueel worden bepaald.
- Bestaand kamer-/verhuurgebruik aanwezig.
- Beoogd aantal appartementen nog niet vastgesteld.
- BVO en GO nog niet betrouwbaar geharmoniseerd; conflicterende oppervlaktematen (430–460 m² versus 566,3 m²).
- Tijdelijke huur met twee relevante einddata, nog uit te werken.

**Uitdrukkelijk onbekend en niet aangenomen:** aantal woningen (eerder "12 woningen" vervalt), aantal verdiepingen (eerder "6" vervalt), volledig commerciële uitgangssituatie (vervalt — bestaand verhuurgebruik is er), fictieve €-bedragen voor investering, exit of bieding.

### 7.1 Wat het huidige model per invoerveld kan dragen

| Gegeven Den Haag | Bestaand veld | Betekenisverlies / risico | Ontbrekend |
| --- | --- | --- | --- |
| Combinatie transformatie + sloop/nieuwbouw | `sell_off_units.strategy` (`transformeren_verkopen`, `nieuwbouw_verkopen`, …) | Sloopkosten hebben geen aparte kolom; vallen impliciet onder `renovation_costs`/`transformation_costs` → verlies van uitsplitsing. | Aparte sloopkostenpost per component; fase-indeling (sloop → nieuwbouw → verkoop). |
| Geen vraagprijs | `asking_price = null` | Zonder verplichte componentstrategie ontbreekt residueel-pad. Score-override slaat over. | Residueel-bod als first-class output onafhankelijk van strategie. |
| Bestaand kamer-/verhuurgebruik | `residential_wws_units`, `annual_rent_actual` | Beperkt: kamerhuur / onzelfstandige eenheden zijn in WWS-modus mogelijk maar niet als aparte huurtak in `pickCorrectedAnnualRent`. | Kamerverhuur als expliciete rent-source; interim-huur tijdens transformatie. |
| Beoogd aantal appartementen nog niet vast | `sell_off_units` (variabel aantal rijen) | Werkbaar zolang gebruiker rijen aanmaakt. Zonder rijen is er geen componentstrategie → geen residueel-pad. | Placeholder-mechanisme "N units, exacte aantal nog onbekend". |
| BVO/GO conflict (430–460 vs 566,3 m²) | `gebo`, `vvo`, `bvo` (elders in objecten) + `sale_sellable_m2` | Compute leest object-GBO; scenario mag `sale_sellable_m2` losstaan → dubbele bron zonder guardrail. | Expliciete oppervlakte-hiërarchie (BVO/GO/VVO) per fase (huidig, na transformatie) met bron-registratie. |
| Tijdelijke huur + twee einddata | Geen expliciete kolom | Interim-cashflow tot einddatum niet modelleerbaar zonder tijdswaarde. | Interim-huur met begin-/einddatum; koppeling aan `sale_expected_period_months`. |
| Post-transformatie OVB-classificatie | Geen | Aankoop-OVB wordt bepaald op basis van huidige `component_type`, maar er is geen kolom om te documenteren waarom (juridische/feitelijke onderbouwing). | Zie hoofdstuk 6.1 punt 3 en hoofdstuk 8. |

### 7.2 Wat pas na aanvullend onderzoek kan worden vastgesteld

- Definitieve BVO/GO na inmeting.
- Aantal en type appartementen (planvorming, gemeentelijke toets).
- Juridische en feitelijke classificatie bij verkrijging voor OVB (zie hoofdstuk 8).
- Sloopvergunning / omgevingsplantoets voor sloop-nieuwbouw-deel.
- Huurbeëindigingsrisico's en einddata (juridische toets).

**Geen euro-uitkomst en geen fictieve bieding worden in dit rapport berekend.** De engine kan de case in beginsel dragen via componentstrategie, maar levert getallen met minstens de bevindingen uit hoofdstuk 6.1 punten 1 tot en met 4 als risicofactor.

## 8. Datamodel en hergebruik

### 8.1 Schema-observaties

- **Geen foreign keys** op `scenario_id` / `component_id` / `calculation_id` in enige VR-tabel — orphan-risico bij directe SQL.
- **Weinig CHECK-constraints:** `sell_off_units.strategy`, `calculation_scenarios.sale_strategy`, `sale_price_source`, `rent_source`, `bid_basis`, `cost_structure`, `mjop_present`, `wws_mode_default` zijn ongebonden `text`.
- **Enums bestaan** voor `vr_calc_status`, `vr_strategy_type`, `vr_ovb_mode`, `vr_ovb_classification`, `vr_component_type`, `vr_input_reliability`, `vr_risk_level`, `vr_huurtype_voor_bieding`, `vr_object_type`, `vr_ovb_allocation_method`, `vr_quality_level` — inconsistent naast de vrije-tekst-velden.
- **`calculation_outputs.scenario_id` is UNIQUE** (1-op-1).
- **`exit_assumptions`** is een volwaardige tabel maar wordt nergens in `src/` gebruikt — dode tabel.
- **`calculation_outputs`** mist onder meer: `exit_based_max_bid`, `bid_basis_used`, `scenario_value`, `hold_value`, `sale_net_proceeds_units`, `max_purchase_price`, `rounds_at_asking`, `leading_max_*`, `strategy_mix`, alle `*_per_m2`, `noi_margin`, `total_correction_pct`, kostenposten-uitsplitsing, `score_label/reason/positive/attention`.
- **Vrijwel elk numeriek veld nullable** zonder 0-default; compute is defensief maar SQL-aggregaties propageren `NULL`.
- **Geen `updated_at`-trigger** — `updated_at` gedraagt zich als `created_at`.

### 8.2 Hergebruiktabel per veld/tabel

Legenda: **Bruikbaar** = ja / deels / nee. **Migratie** = ja / nee / onzeker.

| Veld / tabel | Huidig doel | Bruikbaar | Semantische aanpassing | Migratie | Reden | Risico voor bestaande scenario's |
| --- | --- | --- | --- | --- | --- | --- |
| `calculation_scenarios.asking_price` | Vraagprijs object | Ja | Optioneel maken zonder score-degradatie | Nee | Kolom is al nullable | Geen |
| `calculation_scenarios.sale_target_margin_percentage` | Winst-target % | Deels | Nieuwe semantische labels "winst op kosten" vs "winst op GDV" | Ja (label-kolom of nieuwe kolom) | Vandaag ambigu | Bestaande waarden interpretatie kiezen |
| `calculation_scenarios.sale_expected_period_months` | Verwachte looptijd | Deels | Opslaan is er, doorrekening ontbreekt | Nee (functionele wijziging) | Kolom bestaat, ongebruikt | Bij activering: bestaande scenario's krijgen tijdswaarde-effect — waarschuwen |
| `calculation_scenarios.bid_basis` | Keuze leidend spoor | Ja | Uitbreiden met "residueel" als expliciete waarde | Onzeker (enum vs text) | Nu vrije tekst | Laag |
| `calculation_scenarios.financing_costs` | Eenmalige financieringskost | Deels | Semantiek "totaal", ontkoppeld van LTV/rente | Nee voor Fase 1 | Buiten scope | Geen |
| `sell_off_units.strategy` | Per-unit strategie | Ja | CHECK-constraint of enum toevoegen (later) | Nee voor Fase 1 | Vrije tekst | Data-integriteit |
| `sell_off_units.transformation_costs` / `.renovation_costs` | Extra investering per unit | Ja | Splitsen sloop vs transformatie vs renovatie | Onzeker | Vandaag samengevoegd | Data-migratie bij splitsing |
| `sell_off_units.component_id` | Link naar component | Deels | Fallback `allocated_component_value` toevoegen | Nee | Compute-fix | Geen |
| `calculation_components.*` | Componentdefinitie | Ja | Kolom voor "OVB-classificatie bij verkrijging" toevoegen | **Ja** | Ontbreekt vandaag | Nieuwe kolom, default null |
| `calculation_outputs.*` | Snapshot voor externe consumers | Deels | Uitbreiden of vervangen door `computed_full` (JSONB) | Ja (buiten Fase 1) | Onvolledig vandaag | Externe consumers moeten mee |
| `exit_assumptions` (tabel) | Ontworpen exit-assumpties | Nee | Wordt niet gebruikt | Onzeker | Dode tabel | Buiten Fase 1 laten |
| `scenario_costs.vat_treatment` | Btw-behandeling | Ja | — | Nee | Werkt | Geen |
| `residential_wws_units.*` | WWS-detail | Ja | — | Nee | Werkt | Geen |
| `risk_analysis.*` | Handmatige risicoscore | Ja | — | Nee | Werkt | Geen |

**Onderscheid maken:**
- *Technisch aanwezig*: alle bovenstaande.
- *Daadwerkelijk gebruikt*: alles behalve `exit_assumptions`.
- *Opgeslagen maar niet doorgerekend*: `sale_expected_period_months`, `sell_off_units.hold_valuation_method` bij `later_beslissen`.
- *Outputs die kunnen verouderen*: alle in `calculation_outputs` — omdat de tabel bij edits niet automatisch synchroniseert en niet als leesbron dient.

## 9. Golden-testdekking Fakton

**Belangrijke inperking:** de Excel-werkboeken A5, A8, B2, B9 en B10 zijn niet als bron in dit project aangeleverd. Verwachte euro-uitkomsten en formulepariteit met Fakton kunnen daarom **nu niet worden gecertificeerd**. Dit hoofdstuk beschrijft uitsluitend *testbaarheid* en *ontbrekende invoervelden*.

| Case | Onderwerp (indicatief) | Nu testbaar? | Benodigde rekenfunctie | Ontbrekende invoervelden | Beoogde latere testlaag |
| --- | --- | --- | --- | --- | --- |
| Fakton A5 | Standaard huur/hold-case | Waarschijnlijk gedeeltelijk met bestaande golden-fixtures | `computeScenario` + BAR-tak | Rentabiliteits-invoer per Fakton-conventie onbekend | Golden-vergelijking wanneer bron beschikbaar |
| Fakton A8 | Uitgebreide hold-case | Na uitbreiding | `computeScenario` + `narTotalInvestment` | Idem A5 | Golden-vergelijking |
| Fakton B2 | Buy-fix-sell / uitponden | Na uitbreiding | `computeSale` + `aggregateStrategy` | `strategy.extraInvestmentCosts`-pad in `computeSale` fixen eerst | Golden na fix hoofdstuk 6.1.1 |
| Fakton B9 | Transformatie / herontwikkeling | Niet in Fase 1 zonder Excel-bron | Residueel-bod-pad, OVB-classificatie per fase | Sloopkostenpost, tijdswaarde, OVB post-transformatie | Golden na uitbreiding datamodel |
| Fakton B10 | Sloop-nieuwbouw / grondwaarde | Niet in Fase 1 zonder Excel-bron | Residueel-bod-pad, evt. grondexploitatie | Bouwrente, fasering, sloopkosten | Buiten Fase 1 |

Zonder de brondocumenten worden voor deze cases **geen verwachte euro-uitkomsten verzonnen**.

## 10. Test- en typecheckresultaten

**Vindplaats van tests (feitelijk aangetroffen):**

```
src/test/vastgoedrekenen/feasibility.test.ts
src/test/vastgoedrekenen/vatTreatment.test.ts
src/test/vastgoedrekenen/unitIdentity.test.ts
src/test/vastgoedrekenen/saveGuards.test.ts
src/test/vastgoedrekenen/audit/auditConsistency.test.ts
src/test/vastgoedrekenen/fees/notaryProfile.test.ts
src/test/vastgoedrekenen/fees/integration.test.ts
src/test/vastgoedrekenen/fees/buyerFeeStaffel.test.ts
src/test/vastgoedrekenen/golden/compute.test.ts
src/test/vastgoedrekenen/golden/extra.test.ts
src/test/vastgoedrekenen/golden/fixtures.ts   (fixtures, geen test-runner)
src/test/biedingen/offerAmountParse.test.ts
```

**Uitgevoerde commando's en uitkomst.**

1. `rg --files src/test | rg -i 'vastgoed|calculation|scenario|bieding|roi|exit'` — 12 hits (bovenstaande lijst). Geen aparte submap `src/test/calculation/` of `src/test/exit/`; die bestaan niet.
2. `bunx vitest run src/test/vastgoedrekenen src/test/biedingen/offerAmountParse.test.ts`
   - Test files: **11 passed** (11).
   - Tests: **191 passed** (191).
   - Duration: ~4,1s.
   - Exitstatus: 0.
   - Reeds bestaande fouten: geen.
3. `bunx tsgo --noEmit`
   - Exitstatus: 0.
   - Reeds bestaande fouten: geen.

Er zijn **geen fouten gefixt** — beide runs waren al schoon.

## 11. Minimaal advies voor Fase 1

Fase 1 blijft strikt beperkt tot de residuele kern:

- Componenten die *bestaand behouden of transformeren* zijn.
- Componenten die *slopen en nieuwbouwen* zijn.
- Scenario zonder vraagprijs.
- Residuele maximale koopsom.
- Doelrendement als *winst op kosten* en/of *winst op GDV*.
- Volledige opname van alle investeringskosten.
- OVB als expliciete, onderbouwde invoer.
- Status `Indicatief` bij ontbrekende kerngegevens.
- Status `Voor bieding` alleen na volledige validatie.
- Herstel van formulefouten die de residuele uitkomst direct beïnvloeden (6.1.1, 6.1.2 na verificatie, 6.1.3 minimale variant, 6.1.4).

**Concreet te wijzigen bestanden (Fase 1).**
- `src/lib/vastgoedrekenen/compute.ts` — `computeSale`-aanroep incl. `strategy.extraInvestmentCosts`; residueel-pad ook zonder `strategy.enabled`; correctie van `safety_margin`-optelling in `maxPurchasePrice`; leading-aware score-override ook bij `asking = 0`.
- `src/lib/vastgoedrekenen/verkoop.ts` — nieuwe signature `computeSale(scenario, totalInvestmentInclStrategy, purchasePrice)` of hulpfunctie `computeSaleWithStrategy`.
- `src/lib/vastgoedrekenen/ovb.ts` — expliciete OVB-invoer met onderbouwingsveld; geen automatische afleiding uit eindsituatie.
- `src/lib/vastgoedrekenen/scores.ts` — statuslabels `Indicatief` / `Voor bieding`; leading-override zonder vraagprijs.
- `src/lib/vastgoedrekenen/validation.ts` — validatieregels voor "Voor bieding".
- UI: `src/components/vastgoedrekenen/ScenarioEditor.tsx` en `DealSnapshot.tsx` — status-badge, expliciete OVB-onderbouwing, winst-op-kosten vs winst-op-GDV-label.

**Eventueel benodigde tabellen/kolommen.**
- `calculation_components.ovb_classificatie_bij_verkrijging` (nullable text/enum) — *migratie: ja*.
- `calculation_scenarios.status_label` (`indicatief` / `voor_bieding`) — *migratie: ja*.
- `calculation_scenarios.winst_target_grondslag` (`kosten` / `gdv`) — *migratie: ja*.
- Sloopkostenpost per component — *migratie: onzeker* (kan initieel via bestaande kostenpost-tabel met type-label).

**Benodigde tests.**
- Residueel bod zonder `asking_price` met alleen "bestaand behouden".
- Residueel bod zonder `asking_price` met "sloop + nieuwbouw".
- Guard tegen `safety_margin`-dubbeltelling.
- `computeSale` mét `strategy.extraInvestmentCosts` — ROI/marge/exitBasedMaxBid consistent.
- OVB-classificatie: aankoop-OVB volgt invoer, niet afgeleide eindsituatie.
- Status-label overgang `Indicatief` → `Voor bieding` bij compleetheidsgrens.

**Expliciete uitsluitingen Fase 1 (mogen wel als vervolgadvies benoemd worden):**
- DCF en IRR.
- Volledige financieringsmodule (LTV, rente, aflossing).
- MJOP-fasering.
- N+1-optimalisatie in `ScenarioVergelijking`.
- Algemene foreign keys en database-hardening.
- Save-atomiciteit / rollback.
- Brede snapshotreconstructie van `calculation_outputs`.
- Algemene UI-herbouw.
- Volledige grondexploitatie.
- Niet-residuele architectuurverbeteringen.

## 12. Uitgesloten vervolgonderwerpen

Buiten Fase 1, wel als vervolgadvies genoteerd:

1. Tijdswaarde: activeren van `sale_expected_period_months`, geannualiseerde ROI, IRR, DCF.
2. Bouwrente en gefaseerde financiering.
3. OVB per fase (huidig vs. na transformatie) *automatisch* laten meerekenen — Fase 1 doet alleen expliciete invoer.
4. Aannameprofielen post-transformatie (`mapToAssumptionType`).
5. `calculation_outputs` uitbreiden of vervangen door `computed_full` JSONB; `exit_assumptions` opruimen.
6. Data-integriteit: FKs met `ON DELETE CASCADE`, CHECK-constraints, `updated_at`-trigger.
7. N+1 fetch in `ScenarioVergelijking` batchen.
8. Atomische save via edge-function / RPC.
9. Uniforme feasibility-tolerantie (harmoniseren 2% versus 3% + €50k).
10. WWS-modus-details audit (`src/lib/vastgoedrekenen/wws/`).
11. Kamerverhuur als expliciete rent-source; interim-huur tijdens transformatie.
12. Grondexploitatie / grondwaarde-berekening voor sloop-nieuwbouw.
13. Volledige golden-vergelijking met Fakton A5/A8/B2/B9/B10 zodra brondocumenten beschikbaar zijn.

## 13. Go/no-go A–E

**A. Is de huidige module betrouwbaar genoeg voor eenvoudige quickscans?**
**GO ONDER VOORWAARDEN.** Voor standaard hold- en verkoopcases mét vraagprijs geven de bestaande 191 tests en de aanwezige golden-fixtures redelijk vertrouwen. Voorwaarden: gebruik van `asking_price`, geen zware componentstrategie met transformatiekosten, en bewust omgaan met de bevindingen 6.1.9 (dubbele tolerantie) en 6.1.7 (financiering).

**B. Kan de huidige module Transformatie Den Haag nu adequaat en controleerbaar doorrekenen?**
**NO-GO.** De case combineert (i) geen vraagprijs, (ii) componentstrategie met transformatie/nieuwbouw, en (iii) OVB-vraagstuk bij gemengd vastgoed. Alle drie raken bevestigde bevindingen (6.1.1, 6.1.4) of ontbrekende functionaliteit (6.1.3, 8.2 rijen "sloop", "OVB-classificatie bij verkrijging"). Doorrekenen levert deterministisch onbetrouwbare uitkomsten die niet als bieding gebruikt mogen worden.

**C. Is een minimale residuele Fase 1 zonder vraagprijs functioneel haalbaar?**
**GO.** De residuele kern in hoofdstuk 11 raakt lokaliseerbare code (`compute.ts`, `verkoop.ts`, `ovb.ts`, `scores.ts`, `validation.ts`) en is met bestaande fixtures + nieuwe residueel-tests af te dekken. De formulefouten die de residuele uitkomst raken zijn beperkt in aantal.

**D. Kan Fase 1 volledig met het bestaande datamodel worden gebouwd, of is een gerichte migratie nodig?**
**GO ONDER VOORWAARDEN — gerichte migratie nodig.** Zonder minimaal `calculation_components.ovb_classificatie_bij_verkrijging`, `calculation_scenarios.status_label` en `calculation_scenarios.winst_target_grondslag` (allen nullable, additief, geen data-migratie op bestaande rijen) is de residuele kern niet met de vereiste onderbouwing te realiseren. Sloopkostenpost mag in eerste instantie op de bestaande kostenpost-tabel met type-label.

**E. Is er na deze diagnose voldoende bewijs om Fase 1 te starten, en onder welke harde voorwaarden?**
**GO ONDER VOORWAARDEN.** Harde voorwaarden voor start Fase 1:
1. Vooraf runtime-verificatie van bevinding 6.1.2 (safety_margin-dubbeltelling) op een fixture, met documentatie in `.lovable/`.
2. Vooraf review en akkoord op de drie additieve kolommen genoemd bij D.
3. Fase 1 mag geen enkel uitgesloten onderwerp uit hoofdstuk 12 aanraken.
4. Nieuwe tests voor "residueel bod zonder vraagprijs" landen in dezelfde PR als de code-wijzigingen; tsgo blijft op exit 0.
5. Bestaande golden-fixtures blijven groen; geen bestaande euro-uitkomsten wijzigen zonder expliciet motivatiedocument.

## 14. Bevestiging dat niets is gewijzigd

- Alleen `.lovable/DIAGNOSE-VASTGOEDREKENEN-FASE-0.md` is gewijzigd (dit patch-rapport).
- Geen productiecode gewijzigd.
- Geen database of migratie gewijzigd.
- Geen data gemuteerd.
- Geen functionaliteit gebouwd.
- Fase 1 is niet gestart.
