# Plan: Audit & Diagnostics Mode voor Vastgoedrekenen

## Doel

Een controle- en diagnoselaag bovenop de bestaande Vastgoedrekenen-module. **Geen** wijzigingen aan rekenlogica (tenzij een evidente bug). Alleen lezen, vergelijken en rapporteren. Per scenario kun je met één klik een auditrapport genereren dat datakwaliteit, mapping, save-state, bron-van-waarheid, dubbele tellingen en outputconsistentie controleert.

## Wat de gebruiker krijgt

1. Knop **"Controleer scenario"** in iedere `ScenarioEditor`.
2. Een **AuditDialog** met:
   - Totaalscore (OK / Waarschuwing / Fout).
   - Tabbladen per categorie (A t/m T uit de opdracht).
   - Per check: status, sectie, record, probleem, advies, technische details.
   - **Bron-van-waarheid tabel** (huur, OVB, oppervlakte, exit, etc.).
   - **Stap-voor-stap berekening** van maximale aankoopprijs.
   - **Consistentiecheck** tussen `ScenarioEditor` / `DealSnapshot` / `ScenarioVergelijking` outputs.
   - **Hinthamerstraat testcase** check (alleen actief als scenario matcht op naam/heuristiek).
3. Knop **"Exporteer auditrapport"** → kopieert Markdown naar klembord + download `.md` bestand.

## Architectuur

### Nieuwe bestanden (uitsluitend audit-laag, niet aangeraakt door rekenengine)

```
src/lib/vastgoedrekenen/audit/
  types.ts              # AuditCheck, AuditCategory, AuditReport types
  runAudit.ts           # Hoofdfunctie: runScenarioAudit(scenario, children, calc, object)
  checks/
    saveState.ts        # A. Dirty state, niet-opgeslagen wijzigingen
    objectData.ts       # B. Objectvelden (vraagprijs, oppervlakte, type)
    scenarioSettings.ts # C. Scenario-instellingen (strategy, rekenbasis)
    components.ts       # D. Componenten/units aanwezig en compleet
    wwsMapping.ts       # E. Componenten → WWS
    strategyMapping.ts  # F. Componenten → Componentstrategie
    rentSource.ts       # G+H. Huurbron + WWS gecorrigeerde huur
    ovb.ts              # I. OVB
    costs.ts            # J. Kosten/bouwkosten
    exit.ts             # K. Verkoop/exit
    strategyMix.ts      # L. Componentstrategie mix
    engine.ts           # M. Centrale engine outputs aanwezig
    snapshotConsistency.ts # N+O. Deal Snapshot vs Vergelijking vs Editor
    maxBid.ts           # P. Maximale aankoopprijs stap-voor-stap
    doable.ts           # Q. Rond te rekenen
    doubleCounting.ts   # R. Mogelijke dubbele tellingen
    onderbouwing.ts     # S. Ontbrekende onderbouwing
    formatting.ts       # T. NL nummerformat (steekproef op opgeslagen strings)
  sourcesOfTruth.ts     # Tabel "actieve bron" per onderdeel
  maxBidExplain.ts      # Stap-voor-stap uitleg
  hinthamerstraat.ts    # Vaste testcase-check
  exportMarkdown.ts     # Render AuditReport → Markdown
```

### Nieuwe UI-componenten

```
src/components/vastgoedrekenen/audit/
  AuditButton.tsx       # Knop in ScenarioEditor header
  AuditDialog.tsx       # Dialog met tabbladen
  AuditSummary.tsx      # Totaalscore bovenaan
  AuditCheckRow.tsx     # Individuele check rendering
  SourcesOfTruthTable.tsx
  MaxBidExplain.tsx
```

### Minimale wijzigingen aan bestaande code

- `ScenarioEditor.tsx`: één import + `<AuditButton scenario={...} />` in de header.
- **Geen** wijzigingen aan `compute.ts`, `bieding.ts`, `huur.ts`, `ovb.ts`, `verkoop.ts`, `wws.ts`, `componentStrategy.ts`, `validation.ts`, hooks of database.

## Technische details

### AuditCheck shape

```ts
type AuditStatus = 'ok' | 'warning' | 'error' | 'na';

interface AuditCheck {
  id: string;                // stable key
  category: AuditCategory;   // 'save_state' | 'object_data' | ...
  status: AuditStatus;
  section: string;           // bv. "WWS", "Componentstrategie"
  record?: string;           // bv. "Woning 92A"
  field?: string;
  problem: string;           // korte NL uitleg
  advice?: string;
  technical?: string;        // bv. "wws_unit.living_area_m2 = null"
}

interface AuditReport {
  scenarioId: string;
  scenarioName: string;
  generatedAt: string;
  checks: AuditCheck[];
  sourcesOfTruth: SourceOfTruthRow[];
  maxBidExplain: MaxBidExplainStep[];
  summary: { ok: number; warning: number; error: number; na: number };
  conclusion: string;
}
```

### Save-state detectie

`ScenarioEditor` houdt al een lokale `draft` bij. We voegen een **prop** `dirty: boolean` toe aan `AuditButton` zodat de audit weet of er onopgeslagen wijzigingen zijn. Geen wijziging aan rekenflow.

### Consistentie-check (Deal Snapshot vs Vergelijking vs Editor)

Alle drie roepen `computeScenario` aan. De audit roept `computeScenario` **één keer** aan met de opgeslagen scenariodata en vergelijkt belangrijke outputs (`totalInvestment`, `noi`, `bar`, `nar`, `maxBid`, `scenarioValue`) op gelijkheid binnen €1 tolerantie. Verschil → fout met vermoedelijke oorzaak (meestal: niet-opgeslagen draft of stale prop).

### Stap-voor-stap maxBid

`maxBidExplain.ts` re-runt `computeBidAdvice` met logging van tussenstappen: bruto huur → NOI → kapitalisatie → scenario-waarde → -OVB → -aankoopkosten → -kosten → -veiligheidsmarge → -gewenste marge → maxBid → vergelijk met vraagprijs → "rond te rekenen ja/nee".

### Hinthamerstraat testcase

Heuristiek: object.adres of titel bevat "Hinthamer". Controleert: 8 componenten, 6 woningen + 2 commercieel, strategie-mix (woningen=verkopen, winkels=aanhouden), benodigde velden gevuld. Niet matchend → `status='na'`.

### Export

`exportMarkdown.ts` produceert volledig Markdown rapport met 15 secties (Scenario-info t/m Actiepunten). Knop in `AuditDialog`:
- Kopieer naar klembord (`navigator.clipboard.writeText`)
- Download als `.md` bestand (`Blob` + `<a download>`)

### Geen breaking changes

- Geen wijziging aan DB-schema, migraties of types.
- Geen wijziging aan bestaande compute-functies. De audit-laag gebruikt alléén bestaande publieke functies (`computeScenario`, `computeBidAdvice`, `computeOvb`, etc.) en leest scenariokinderen.
- `validation.ts` blijft ongemoeid; de auditlaag is een uitbreiding (rijker en op verzoek), niet een vervanger.

## Acceptatie

- Eén klik = volledig rapport in dialog.
- Alle 20 categorieën (A–T) hebben minimaal één concrete check.
- Bron-van-waarheid tabel toont actieve + alternatieve bron + risico.
- MaxBid stap-voor-stap zichtbaar in dialog en export.
- Markdown export downloadbaar en kopieerbaar.
- Hinthamerstraat-check werkt op het bestaande object zodra het scenario "woningen verkopen, winkels houden" is.
- TypeScript build groen, geen wijziging aan bestaande tests.
