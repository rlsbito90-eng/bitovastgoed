## Doel

Vastgoedrekenen herstructureren naar een rustige, premium "underwriting cockpit" volgens Concept 1 (Premium Deal Cockpit) + Concept 2 (Analyst Workspace tabellen). Geen rekenlogica wijzigen, alle 165 tests groen houden.

## Aanpak in volgorde

### 1. Centrale sectieconfiguratie (lost #3 nummering + #5 bedieningsstructuur op)
Nieuwe module `src/components/vastgoedrekenen/cockpit/sectionConfig.ts`:
- Eén `SectionKey` union (`cockpit`, `aankoop`, `componenten`, `componentstrategie`, `opbrengsten`, `bouwkosten`, `wws`, `waterfall`, `onderbouwing`).
- Vaste volgorde + labels + relevantie-functie per strategie/spoor.
- `numberSections(visibleKeys)` levert dynamische `01..NN` op basis van daadwerkelijk gerenderde keys — geen hardcoded nummers meer.
- Strategie-presets: `verkoop`, `huur_bar`, `componentstrategie` → set van keys die "Strategie-view" open zet.

### 2. Hoofdstuk- vs. accordion-hiërarchie (lost #2 op)
- Nieuwe `ChapterHeader` component: grote uppercase titel met nummer (`01 — SCENARIO-COCKPIT`), navy accent, subtiele divider, ruime top-spacing. Niet klikbaar.
- Bestaande `Section` blijft de accordion-card (witte card, border, radius, statuschip + samenvatting rechts), maar krijgt geen eigen nummer meer — nummer komt uit `ChapterHeader` erboven.
- Groepering: één `ChapterHeader` per hoofdstuk, daaronder 1+ `Section`-cards waar zinvol. Voor hoofdstukken met één card vervalt de accordion-wrapper niet, maar de visuele scheiding komt van de header.

### 3. Accordion-bediening (lost #5 + #9 op)
- Boven de hoofdcontent een compacte toolbar: `Alles uitklappen` / `Alles inklappen` / `Strategie-view` (split-button met huidige strategie als label).
- `ScenarioEditor` krijgt `openSections: Record<SectionKey, boolean>` state; bestaande per-sectie open/dicht-logica blijft als initial state.
- `Strategie-view` past preset uit sectionConfig toe; aandacht/blocker secties blijven altijd open.
- Waterfall opgenomen in deze bediening; standaard open bij verkoop/exit + strategie-view.

### 4. Sticky werkstroomrail echt fixen (lost #6 op)
- Audit parent chain (`ObjectDetailPage`, `VastgoedrekenenTab`, tab-container) op `overflow-hidden`, `transform`, vaste height — root cause is meestal een `overflow-x-hidden` op een tussenliggende wrapper.
- Layout in `ScenarioEditor` herzien: rail in eigen grid-kolom met `position: sticky; top: 88px; align-self: start;` op het direct kind van de grid. Geen `h-full` parents.
- Interne scroll op rail blijft (`max-h-[calc(100vh-104px)] overflow-y-auto`).

### 5. Hernoeming + structuurfix (lost #4 op)
- "Kosten & OVB" / "Kosten & bouwkosten" → **"Bouw-/renovatiekosten"**. OVB-velden + ovb-mode blijven exclusief in hoofdstuk "Aankoop & uitgangspunten".
- Sectie-key/label hernoemen in `sectionConfig`, alle referenties (rail, header, anchors) volgen automatisch.

### 6. Statuschips uniformeren (lost #7 op)
- Centrale `chipLabel(kind)` helper met set: `OK | LET OP | INFO | NVT | INCOMPLEET | HANDMATIG`.
- Bestaande lange labels ("WWS indicatief — niet alle velden compleet", "OVB-grondslag ontbreekt", "Niet compleet") vervangen door korte chip + lange uitleg naar `title`/tooltip of detail-drawer.

### 7. Tabellen consistent maken (lost #8 op)
- `ComponentenTable` is referentie. `WwsUnitsTable` en `ComponentStrategyTable` krijgen:
  - zelfde rijhoogtes (`text-xs`, `[&_th]:px-2 [&_td]:px-2`),
  - zelfde sticky unit-kolom (`sticky left-0 bg-card`),
  - zelfde totalenrij-stijl (`bg-muted/60 font-semibold border-t-2`, totals onder juiste kolommen),
  - zelfde chip-set (#6).

### 8. Audit-summary compacter (lost #10 op)
- `AuditSidePanel`: "Gebruikte bronnen" → strakke key-value rij (`grid grid-cols-[1fr_auto]` met dunne dividers), kleinere `gap-1`. Top aandachtspunten ongewijzigd qua prominentie.

### 9. Notitieveld vergroten (lost #11 op)
- `RawTextarea` voor scenario-notities: `rows={7}`, `min-h-[200px]`, full-width binnen card, `leading-relaxed`.

### 10. Bito-huisstijl gerichter (lost #12 op)
- `ChapterHeader` gebruikt navy tekst + dunne gouden accent-lijn.
- Cockpit-header behoudt huidige tokens.
- Statuschips: groen alleen voor `OK`, amber voor `LET OP`, neutraal grijs voor `INFO/NVT`, destructive voor `INCOMPLEET (blocker)`. Geen extra kleur op rustige inhoud.

## Bestanden (toevoegen)
- `src/components/vastgoedrekenen/cockpit/sectionConfig.ts`
- `src/components/vastgoedrekenen/cockpit/ChapterHeader.tsx`
- `src/components/vastgoedrekenen/cockpit/AccordionToolbar.tsx`
- `src/components/vastgoedrekenen/cockpit/statusChips.ts`

## Bestanden (wijzigen)
- `src/components/vastgoedrekenen/ScenarioEditor.tsx` (hoofdstuk-wrapping, toolbar, controlled open-state, sticky grid)
- `src/components/vastgoedrekenen/Section.tsx` (controlled `open`-prop accepteren, nummer-prop optioneel, geen eigen telling)
- `src/components/vastgoedrekenen/cockpit/SectionRail.tsx` (sectie-keys uit sectionConfig)
- `src/components/vastgoedrekenen/cockpit/AuditSidePanel.tsx` (compact bronnen)
- `src/components/vastgoedrekenen/cockpit/WwsUnitsTable.tsx`, `ComponentStrategyTable.tsx` (chip-set + sticky kolom + totals)
- `src/components/vastgoedrekenen/cockpit/InvesteringsWaterfall.tsx` (header-tekst uitgebreid)
- `src/components/vastgoedrekenen/VastgoedrekenenTab.tsx` + `src/pages/ObjectDetailPage.tsx` (parent overflow/sticky audit)

## Niet doen
- Geen wijzigingen aan `compute.ts`, `wws.ts`, `investering.ts`, `verkoop.ts`, `huur.ts`, `ovb.ts`, `componentStrategy.ts`, `bieding.ts`, `scores.ts`, `validation.ts`, `saveGuards.ts`.
- Geen DB-migraties.
- Geen nieuwe features buiten bovenstaande UX-scope.

## Tests
- Alle bestaande 165 tests moeten groen blijven.
- Smoke-check: rendering ScenarioEditor met de bestaande golden fixtures (verkoop / huur / componentstrategie) — geen prop-API-breuk voor `onUpdate`/`onDelete`.

Akkoord? Dan voer ik dit in één implementatieronde uit en bevestig met test-output.