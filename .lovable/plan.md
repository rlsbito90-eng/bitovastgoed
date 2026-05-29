# Performanceplan Vastgoedrekenen & CRM

Onderzoek-only ronde. Geen code, geen rekenlogica. Focus: vinden wat traag is, prioriteren, risico's benoemen, gefaseerd bouwplan voorstellen.

## A. Top bottlenecks (diagnose)

### 1. Refetch-storm in `useScenarioChildren` & `useQuickscanDetail` — IMPACT: HOOG
**Locatie:** `src/hooks/useVastgoedrekenen.tsx` (regels 152-247) en `src/components/vastgoedrekenen/ScenarioVergelijking.tsx` (regels 25-50).

Iedere mutatie (update component, kosten, WWS-unit, sell-off, scenario) eindigt met `await fetchAll()`. `fetchAll` doet **6 parallelle Supabase-queries** voor de scenario-children, plus 2 voor de quickscan. Eén keystroke-blur op een component-veld kost dus minimaal 6 round-trips waarna alle children opnieuw worden ingezet → cascading re-renders van ScenarioEditor + alle tabellen.

Daarbovenop mount `ScenarioVergelijking` één `ScenarioComputer` per scenario, en elk daarvan roept opnieuw `useScenarioChildren(s.id)` aan. Met 4 scenario's en de open editor → **5× dezelfde queries** voor het actieve scenario.

**Fix-richting:** optimistische local state-updates (al uit DB-respons), patch-by-id i.p.v. fetchAll, en deduplicate `useScenarioChildren` via een lichte cache/context.

### 2. `outputs` invalideert te vaak in `ScenarioEditor` — IMPACT: HOOG
**Locatie:** `src/components/vastgoedrekenen/ScenarioEditor.tsx` regels 224-235.

`useMemo` voor `computeScenario` heeft `s` (heel scenario-object), `components`, `draftCosts`, `wwsUnits`, `sellOffUnits`, `taxSettings`, en losse `props.objectWoz/objectEnergyLabel/objectBouwjaar` als deps. Bij iedere `patch()` wordt `s` een nieuw object → recompute. Dat is wenselijk voor data-edits, maar:

- `setDirty(...)`, `setDraftCosts(...)` en andere puur-UI state-updates triggeren ScenarioEditor-render. JSX rebuilt alle `<Section>`-element-objects (1824 regels component). Open secties met `<ComponentenTable>`, `<WwsUnitsTable>`, `<ComponentStrategyTable>`, `<InvesteringsWaterfall>` en `<ResultaatKaart>` re-renderen zonder memoization → DOM-diff over honderden cellen.
- `outputs` wordt door 5+ kinderen geconsumeerd (CockpitHeader, ResultaatKaart, InvesteringsWaterfall, AuditSidePanel, NoiOpbouw, NogTeControleren, ScenarioVergelijking-rows). Geen van deze is `React.memo` → re-render bij elke parent-render, ook als `outputs` referentie-gelijk is gebleven.

**Fix-richting:** `React.memo` op zware presentational components (`ComponentenTable`, `WwsUnitsTable`, `ComponentStrategyTable`, `InvesteringsWaterfall`, `ResultaatKaart`, `CockpitHeader`, `AuditSidePanel`, `NoiOpbouw`). Splits ScenarioEditor in kleinere subcomponents zodat lokale state (zoals `selectedWwsIds`, `openAccordion`) niet de hele boom invalideert.

### 3. `AuditDialog` rebuilt audit + extra `computeScenario` bij elke render — IMPACT: MIDDEL
**Locatie:** `src/components/vastgoedrekenen/audit/AuditDialog.tsx` regels 49, 62-89.

`buildInput` is een prop-functie die in `ScenarioEditor` per render opnieuw wordt gemaakt → `useMemo([open, tick, buildInput])` invalideert per parent-render. Daardoor draait `runScenarioAudit` + een extra `computeScenario` per render zolang het dialog open is. Dit is functioneel goed (live audit), maar geen debounce → typestorm = audit-storm.

**Fix-richting:** debounce of stabiliseer `buildInput` met `useCallback` in `ScenarioEditor`; audit alleen bij open dialog en op input-commits, niet op elke render.

### 4. `ScenarioVergelijking` mount per scenario een eigen children-fetcher — IMPACT: MIDDEL
**Locatie:** `src/components/vastgoedrekenen/ScenarioVergelijking.tsx` regels 25-50.

Elke `ScenarioComputer` roept `useScenarioChildren(s.id)` → 6 queries × N scenario's bij eerste mount. Bovendien wordt `shared` in `ScenarioEditor`/`VastgoedrekenenTab` per render herbouwd → useMemo([..., shared, ...]) invalideert telkens → herberekening.

**Fix-richting:** één centrale "scenario-children store" (Context of TanStack Query) zodat ScenarioVergelijking + ScenarioEditor dezelfde data delen. `shared` stabiliseren met `useMemo` of primitives uitsplitsen.

### 5. Inputs zijn `React.memo`, maar callbacks niet stabiel — IMPACT: MIDDEL-LAAG
**Locatie:** `src/components/vastgoedrekenen/RawInputs.tsx` regels 69/86/118.

`RawTextInput`/`RawNumberInput`/`RawTextarea` zijn al `memo()`, maar `onCommit` en `onRawChange` worden in `ScenarioEditor` inline als arrow-functies meegegeven → elke parent-render geeft nieuwe referentie → memo werkt feitelijk niet. Bij ~50 inputs op één pagina is dat veel onnodige render-werk.

**Fix-richting:** ofwel ScenarioEditor opdelen zodat input-rijen lokaal hun handler kunnen krijgen, ofwel een gestabiliseerde patcher per veld via `useCallback`+ref. Belangrijke nuance: `RawNumberInput` houdt eigen state, dus de re-render is goedkoop — wel buggy als parent-state midden in focus zou wijzigen. Lagere prioriteit dan #1-#4.

## B. Antwoorden op specifieke vragen

- **Wordt `computeScenario` te vaak aangeroepen?** In ScenarioEditor: redelijk — alleen op commits door useMemo. In AuditDialog: ja, dubbel (`runScenarioAudit` doet zijn eigen `computeScenario`, en `derived` doet er nog één bovenop). In ScenarioVergelijking: 1× per scenario, prima — maar de `shared` referentie-instabiliteit triggert herberekening bij parent-renders.
- **Delen KPI-header, ResultaatKaart, ScenarioVergelijking, Waterfall, AuditSidePanel dezelfde computed output?** Binnen ScenarioEditor ja (`outputs` van de useMemo). ScenarioVergelijking rekent **apart** per scenario via `ScenarioComputer` (noodzakelijk omdat het meerdere scenario's vergelijkt en hun children eerst moet ophalen).
- **Renderen gesloten accordionsecties zware inhoud?** Het DOM wordt niet gemount (`{open && <div>...</div>}` in `Section.tsx` regel 114), dus geen DOM-werk. **Maar** de JSX-children worden in `ScenarioEditor` wel geëvalueerd → React-element-objecten worden aangemaakt, en eventueel doorgegeven props/callbacks ook. Bij `<ComponentStrategyTable units={...} />` als child van een gesloten Section: het element-object wordt aangemaakt, maar `ComponentStrategyTable` rendert niet — dat is licht.
- **Draait audit live?** AuditSidePanel rendert direct uit `outputs` + validation-items → goedkoop. Volledige `runScenarioAudit` draait alleen in geopende AuditDialog, maar daar wel bij elke parent-render → debounce gewenst.
- **Worden tabellen volledig opnieuw gerenderd bij kleine edits?** Ja — geen `memo` op `ComponentenTable`/`WwsUnitsTable`/`ComponentStrategyTable`/`InvesteringsWaterfall`. Bij elke commit-cycle rebuilden ze hun hele rij-set. Verwachte winst van memoization: significant.
- **Onnodige Supabase-refetches?** Ja, zie bottleneck #1 en #4 — fetchAll-pattern + dubbele fetches per scenario.
- **Zijn de nieuwe dirty/touch guards performance-neutraal?**
  - `useIsTouch`: 1× `matchMedia`-listener, neutraal.
  - `useTapVsScroll`: `useCallback`'d handlers, neutraal.
  - `useDirtyGuard`: 1× `beforeunload` listener, neutraal.
  - `useFormDirtyGuard`: doet `JSON.stringify(form)` **elke render** om dirty te berekenen. Voor grote form-objecten (ObjectFormDialog!) merkbaar bij typen. Klein risico, eenvoudig op te lossen met `useMemo` of een shallow-equal.
- **3 grootste wins (verwacht):** (1) refetch-storm vervangen door optimistische update + targeted refetch, (2) `React.memo` op zware kindcomponenten + stabiele callbacks waar haalbaar, (3) gedeelde scenario-children store + lazy-load van AuditDialog / ScenarioVergelijking-zware code.

## C. Quick wins (veilig voor BUILD)

| # | Optimalisatie | Bestand(en) | Impact | Risico | Complex. |
|---|---|---|---|---|---|
| Q1 | `React.memo` om `ComponentenTable`, `WwsUnitsTable`, `ComponentStrategyTable`, `InvesteringsWaterfall`, `ResultaatKaart`, `CockpitHeader`, `AuditSidePanel`, `NoiOpbouw` | `src/components/vastgoedrekenen/cockpit/*`, `ResultaatKaart.tsx`, `NoiOpbouw.tsx`, `ComponentStrategyTable.tsx` | Hoog | Laag — props zijn al stabiel-genoeg (objects komen uit useMemo / useState) | S |
| Q2 | `useFormDirtyGuard`: `JSON.stringify` cachen achter `useMemo([value])` of vervangen door diepte-1 compare | `src/hooks/useFormDirtyGuard.tsx` | Middel (typen in grote dialogs) | Laag | XS |
| Q3 | `AuditDialog`: stabiliseer `buildInput` in caller met `useCallback` + 200 ms debounce op de `useMemo` dependency | `src/components/vastgoedrekenen/ScenarioEditor.tsx` + `audit/AuditDialog.tsx` | Middel | Laag | S |
| Q4 | `ScenarioVergelijking`: `shared` met `useMemo` stabiliseren in caller; verwijder `shared` uit dep-array en gebruik losse primitives | `VastgoedrekenenTab.tsx` of `ScenarioVergelijking.tsx` | Middel | Laag | XS |
| Q5 | Lazy-load `AuditDialog` + `exportAuditMarkdown` met `React.lazy` (alleen laden bij open) | `ScenarioEditor.tsx` | Laag-Middel (bundle + first-render) | Laag | XS |
| Q6 | Lazy-load `VastgoedrekenenTab` in `ObjectDetailPage` (`React.lazy` + Suspense) | `src/pages/ObjectDetailPage.tsx` | Middel (bundle initial) | Laag | XS |
| Q7 | Memoize formatter-resultaten in tabel-rijen (fmtEur/fmtPct) of verplaats naar pure render — alleen waar het meet | tabellen | Laag | Laag | S |
| Q8 | `useScenarioChildren.fetchAll`: na een mutatie alleen de getroffen tabel re-mappen i.p.v. alle 6 (optimistic patch op `components`/`costs`/etc.) | `useVastgoedrekenen.tsx` | Hoog | Middel — testdekking voor edge cases nodig (delete, fail-rollback) | M |
| Q9 | `useQuickscanDetail.updateScenario`: optimistic patch op `scenarios[]` i.p.v. `await fetchAll()` | `useVastgoedrekenen.tsx` | Hoog | Middel | M |

## D. Grotere optimalisaties (later)

| # | Optimalisatie | Impact | Risico | Complex. |
|---|---|---|---|---|
| G1 | Centrale `ScenarioChildrenContext` of TanStack Query: deduplicate fetch tussen `ScenarioVergelijking.ScenarioComputer` en `ScenarioEditor` voor hetzelfde scenario | Hoog | Middel — refactor van data-laag | L |
| G2 | `ScenarioEditor` (1824 r.) opsplitsen in subcomponents per hoofdstuk (CockpitChapter, InvesterenChapter, …) zodat lokale state niet alles invalideert | Hoog | Middel-Hoog — veel raakvlak, regression-risico | L |
| G3 | Virtualisatie (`@tanstack/react-virtual`) op `ComponentenTable`/`WwsUnitsTable`/`ComponentStrategyTable` zodra >50 rijen voorkomen | Laag (geen klant zit daar nu) | Middel | M |
| G4 | `computeScenario` naar Web Worker bij zeer grote scenario's (>200 units) | Laag op huidige schaal | Hoog (async maakt UI-flow complex) | L |
| G5 | Bundle-splitsing op route-niveau (`React.lazy` per page in `App.tsx`) | Middel | Laag | S |
| G6 | Caching op `useTaxSettings` (nu fetch bij elke `useTaxSettings`-call) — verplaatsen naar app-niveau context | Laag | Laag | S |

## E. Wat niet doen (lage ROI / hoog risico)

- **Geen** `useMemo` om triviale primitives of korte string-formats — kost meer dan het bespaart.
- **Geen** refactor van `computeScenario` of audit-logica — uit scope, hoog regressie-risico, tests dekken puur de huidige API.
- **Geen** vervanging van shadcn-componenten door eigen primitives "voor de snelheid" — de winst zit niet daar.
- **Geen** virtualisatie zolang tabellen <50 rijen tellen — meetbaar nadeel op kleinere lijsten (sticky headers, focus management).
- **Geen** SSR/streaming-experimenten — Vite SPA, niet de tijdsinvestering waard.

## F. Voorgestelde fasering

**Fase 1 — Veilige quick wins (1 ronde)**
- Q1 React.memo op zware children
- Q2 dirty-guard memoization
- Q5 lazy AuditDialog
- Q6 lazy VastgoedrekenenTab
- Tests: alle 165 vitest-tests; visuele rooktest van Vastgoedrekenen + Object/Relatie/Deal dialogs.

**Fase 2 — Render & compute (1 ronde)**
- Q3 audit-debounce + stabiele `buildInput`
- Q4 `shared` stabiliseren in ScenarioVergelijking
- Optioneel: ScenarioEditor JSX splitsen waar low-risk (Cockpit-blok, Audit-blok)
- Tests: golden compute-tests moeten 100% groen blijven (geen rekenwijzigingen).

**Fase 3 — Data fetching (1-2 rondes)**
- Q8/Q9 optimistic updates + targeted refetch
- G1 gedeelde children-store
- G6 tax-settings cachen
- Tests: saveGuards-tests + handmatige round-trip test (component aanpassen → outputs herrekend → DB consistent).

**Fase 4 — Grote opties (alleen indien nog steeds nodig)**
- G2 ScenarioEditor opsplitsen
- G3 virtualisatie
- G4 web worker
- G5 route-lazy
- Eerst meten met `browser--performance_profile` na Fase 1-3; veel kans dat het dan al niet meer nodig is.

## G. Minimale testset na elke fase

- `bunx vitest run` — alle 165 tests groen, met name:
  - `src/test/vastgoedrekenen/golden/compute.test.ts` (56 tests)
  - `src/test/vastgoedrekenen/golden/extra.test.ts` (63 tests)
  - `src/test/vastgoedrekenen/saveGuards.test.ts` (5 tests)
- Handmatige rooktest:
  1. Object openen → tab Vastgoedrekenen → scenario openen → 1 component-veld wijzigen → outputs herzien, audit-paneel klopt, geen dubbele toasts.
  2. Tweede scenario openen → ScenarioVergelijking toont beide.
  3. Object/Relatie/Deal dialog openen → veld wijzigen → sluiten zonder opslaan → dirty-guard triggert.

## H. Wat is veilig voor BUILD zonder rekenlogica te raken?

Alle items in C en G1/G5/G6. Specifiek **niet** raken: `src/lib/vastgoedrekenen/compute.ts`, `audit/runAudit.ts`, `wws.ts`, `componentStrategy.ts`, `verkoop.ts`, `huur.ts`, `ovb.ts`, `investering.ts`, `bieding.ts`, `conclusie.ts`, `scores.ts`, `profiles.ts`. Alle wijzigingen blijven in components, hooks en bundling.
