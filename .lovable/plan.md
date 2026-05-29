
# Fase 4 — Premium Deal Cockpit

Dit is een grote UI/UX-herindeling van Vastgoedrekenen die ik in **vier veilige sub-fasen** wil uitvoeren. Geen nieuwe rekenlogica; alleen presentatie van bestaande outputs. Alle 160 tests blijven groen tussen elke sub-fase door.

## Uitgangspunten

- Dezelfde data-pipeline: `ComputedOutputs` (incl. `leadingMax*`, `roundsAtAsking`), `ScenarioEditor` blijft de orkestrator.
- Bito huisstijl (donker, ingetogen goud/oranje accent) — bestaande semantic tokens uit `index.css`/`tailwind.config.ts` uitbreiden waar nodig, geen nieuwe rauwe kleuren in componenten.
- Geen breaking changes voor `ScenarioVergelijking`, `AuditDialog`, `BulkFillDialog`, scoring of `compute.ts`.

## Sub-fase 4A — Cockpit shell + KPI-balk + globale selector

- Nieuwe `CockpitShell` component met:
  - Header (object/scenario/relatie/deal/status + opslaan/delen).
  - 7-KPI strip op basis van `leadingMax*`: Rond te rekenen, Max. aankoopprijs, Vraagprijs, Verschil, ROI, Netto marge, Score, Commissie.
  - "Scenario-uitkomst gebaseerd op" selector promoten naar cockpit-niveau (bovenaan, sticky onder header) — synced met bestaande `leading_valuation_track`.
  - Informatieve secundaire regel: alternatieve sporen ("Verkoop/exit: …", "Huur/BAR: …").
- `ResultaatKaart` blijft bestaan voor scenariovergelijking-context maar wordt visueel slanker; de cockpit is de nieuwe hoofdbron.

## Sub-fase 4B — Linker workflow-nav + voortgangsbalk

- Nieuwe `SectionRail` (linker kolom op desktop ≥lg, accordion bovenaan op mobiel):
  - 9 secties: Resultaat & cockpit, Aankoop & uitgangspunten, Componenten/units, Strategie per component, Opbrengsten, Kosten & OVB, WWS-analyse, Onderbouwing & audit, Scenario's vergelijken.
  - Statuschip per sectie (OK / aandacht / blocker / niet relevant) afgeleid van bestaande relevance/warning-logica uit fase 3.
  - Tellers van aandachtspunten.
  - Klik scrollt naar anchor + opent sectie (gebruik bestaande Section `defaultOpen` infra).
  - Voortgangsbalk "X / 9 secties compleet".

## Sub-fase 4C — Compacte componententabel + detail-drawer

- Nieuwe `ComponentTable` als standaardweergave (vervangt repeterende kaarten):
  - Kolommen: Unit, Type, Gebruik, GBO, Strategie, Markthuur, OVB-tarief, OVB-grondslag, OVB-bedrag, WWS, Status.
  - Totalenregel + warnings ("2 units zonder markthuur").
  - Klik op rij → `UnitDetailDrawer` met de bestaande invoer-card hergebruikt (geen logica-duplicatie).
  - Toggle "Kaartweergave" behoudt fallback voor wie dat prefereert.
- Bulk-invullen / herberekenen blijft werken; chip-navigatie uit fase 2 wijst nu naar tabelrijen.

## Sub-fase 4D — Waterfall + audit-zijpaneel + bron-affordances

- Nieuwe `InvesteringsWaterfall` (pure SVG, geen libs) met bestaande waarden: vraagprijs → kosten → OVB → verkoopkosten → netto opbrengst → netto marge.
- Nieuw `AuditSidePanel` (rechts op ≥xl, collapsible):
  - Aantal aandachtspunten, top blockers/warnings, gebruikte bronnen (Componenten/Strategie/WWS/Handmatig/Scenario-level), betrouwbaarheid, knop naar bestaande `AuditDialog`.
- Visueel onderscheid invoer vs berekend systematisch toepassen via een kleine helper (`<ValueField variant="input|computed|derived|info|missing" source="…" />`) — generaliseert wat nu ad-hoc met dashed borders gebeurt.

## Bestandsplan (indicatief)

```
src/components/vastgoedrekenen/cockpit/
  CockpitShell.tsx           (4A)
  CockpitHeader.tsx          (4A)
  KpiStrip.tsx               (4A)
  TrackSelector.tsx          (4A — extractie uit ScenarioEditor)
  SectionRail.tsx            (4B)
  ComponentTable.tsx         (4C)
  UnitDetailDrawer.tsx       (4C)
  InvesteringsWaterfall.tsx  (4D)
  AuditSidePanel.tsx         (4D)
  ValueField.tsx             (4D)
edits:
  ScenarioEditor.tsx         (alle sub-fasen — wrap in CockpitShell, secties krijgen anchors)
  ResultaatKaart.tsx         (4A — afslanken / hergebruik in vergelijking)
  ComponentStrategyTable.tsx (4C — gedeelde unit-row stijl)
index.css / tailwind.config  (4A — eventueel extra tokens voor cockpit-surface)
```

## Test-strategie

- Geen UI-tests toevoegen.
- Bestaande 160 golden/unit tests draaien na elke sub-fase.
- Alleen nieuwe pure helpers (bv. status-aggregatie voor SectionRail) krijgen kleine unit tests indien gedeelde logica wordt uitgepakt.

## Aanpak

Ik begin met **sub-fase 4A** zodra je akkoord bent, en stop daarna kort om je het resultaat te laten zien voordat ik 4B start. Zo blijft de scope per ronde behapbaar en kun je per stap bijsturen.
