## Doel

Vastgoedrekenen rekenkundig en vastgoedkundig betrouwbaarder maken — zonder nieuwe rekenfeatures. We versterken validatie, uitlegbaarheid en testdekking. Bestaande rekenlogica (`computeScenario`, `investering.ts`, `huur.ts`, `verkoop.ts`, `bieding.ts`) blijft ongewijzigd.

## Aanpak in 7 stappen

### 1. Casustype-matrix (`src/lib/vastgoedrekenen/validation/caseRequirements.ts` — nieuw)

Eén centrale tabel `CASE_REQUIREMENTS` per casustype met:
- `requiredFields` — blokkerend
- `optionalFields` — info
- `defaults` — wat het systeem invult als leeg
- `outputs` — relevante eindvelden
- `notes` — vastgoedkundige aandachtspunten

Casustypes (aansluitend op bestaande `strategy_type` + `sale_strategy` + componentmix):
verhuurde_belegging, leegstand, mixed_use, uitponden, woningen_verkopen_winkels_houden, alles_houden, alles_verkopen, renovatie_verkoop, renovatie_verhuur, transformatie_verkoop, transformatie_verhuur, bedrijfsunits, woon_winkel.

Functie `detectCaseType(scenario, components, strategyUnits)` mapt huidige data naar één casustype zodat de juiste vereistenlijst geactiveerd wordt.

### 2. Expliciete veldstatus (`src/lib/vastgoedrekenen/validation/fieldStatus.ts` — nieuw)

Helper `fieldStatus(value, { hasManualMarker?, defaultUsed? })` → `'ingevuld' | 'leeg' | 'bewust_nul' | 'default' | 'handmatig'`.

Regels:
- `null`/`undefined`/`''` → `leeg`
- `0` met expliciete marker (bv. `*_manually_zero` flag of veld zit in `manual_zero_fields[]`) → `bewust_nul`
- `0` zonder marker → `leeg` (waarschuwing) i.p.v. stil 0
- default-aanname uit profiel → `default`
- handmatige override (`assumptions_manual`, `*_manual_override`) → `handmatig`

In `validation.ts` en `runAudit.ts` vervangen we `Number(x ?? 0) > 0`-checks door `fieldStatus()` zodat lege velden niet onzichtbaar als 0 doortellen.

Voor bewust-0 voegen we per kritisch veld een eenvoudige UI-marker toe (checkbox "bewust 0") in `ScenarioEditor.tsx` voor: bouwkosten, verkoopkosten, overige verkoopkosten, financieringskosten. Geen nieuwe DB-kolommen; we hergebruiken bestaande `*_manual_override`-velden waar mogelijk, en slaan losse markers op in `scenario.assumptions_source` (JSON-veld al aanwezig).

### 3. Rekenketen-uitleg uitbreiden (`src/lib/vastgoedrekenen/audit/maxBidExplain.ts` + nieuwe `calcChain.ts`)

Nieuwe helper `buildCalcChain(input, computed)` levert stap-voor-stap regels:

```text
Input → bruto opbrengst → kosten → netto opbrengst →
scenariowaarde → totale investering → marge/ROI →
max aankoopprijs → verschil vraagprijs → rond te rekenen
```

Per stap: `gebruikte velden`, `formule`, `uitkomst`, `bron`, `status (ingevuld/default/ontbreekt/handmatig)`. Toegevoegd als nieuwe tab "Rekenketen" in `AuditDialog.tsx`.

### 4. Betrouwbaarheidsscore (`src/lib/vastgoedrekenen/validation/reliability.ts` — nieuw)

`computeReliability(ctx, computed)` → `'hoog' | 'middel' | 'laag' | 'niet_betrouwbaar'` + lijst van redenen.

Regels:
- Blokkerende vereiste leeg → `niet_betrouwbaar`
- ≥3 warnings of belangrijke handmatige waarde zonder onderbouwing of dubbele bron → `laag`
- 1–2 warnings of defaults op niet-kritieke velden → `middel`
- Alle vereisten ingevuld, geen warnings → `hoog`

Tonen in:
- `ResultaatKaart.tsx` (badge)
- `AuditDialog.tsx` overzicht
- `DealSnapshot.tsx`

Bestaande `inputReliability` in `ComputedOutputs` blijft; nieuwe score is rijker en vervangt het in de UI-badge maar we mappen oude waarde door voor backcompat.

### 5. Blokkerend vs niet-blokkerend (`validation.ts` + `runAudit.ts`)

`ValidationItem.level` blijft `blocker | warning | info`. We mappen volgens specificatie van de gebruiker:

Blokkerend: verkoopwaarde-ontbreekt-bij-verkoop, huur-ontbreekt-bij-aanhouden, BAR/NAR/factor-ontbreekt-bij-aanhouden, aankoopprijs leeg, OVB onbekend bij niet-manual, scenario zonder waardebron.

Niet-blokkerend: WOZ, energielabel, btw-bouwkosten niet beoordeeld, verkoopkosten op default, bouwkosten indicatief, handmatig zonder onderbouwing.

`ResultaatKaart` toont een `Niet betrouwbaar — blokkerende issues` banner zolang er blockers zijn.

### 6. Golden testcases (`src/test/vastgoedrekenen/golden/` — nieuw)

Vitest-suite met 8 fixtures:
1. Simpele verhuurde belegging
2. Retailbelegging
3. Mixed-use woon-/winkelpand
4. Hinthamerstraat (woningen verkopen, winkels houden) — leidend
5. Alles verkopen per unit
6. Renovatie + verkoop
7. Transformatie naar wonen
8. Bedrijfsunits

Elke fixture: `{ scenario, components, costs, wwsUnits, strategyUnits }` + `expected: { grossSale, costs, totalInvestment, maxBid, diffAsking, rounds }`.

Tests gebruiken `computeScenario` direct en vergelijken numeriek (`±€1`). Faalt zodra rekenlogica afwijkt.

### 7. Hinthamerstraat als hoofdtest

Bestaande `audit/hinthamerstraat.ts` blijft als runtime-check. Aanvullend: de golden fixture in stap 6 dekt dezelfde casus end-to-end zodat regressies in CI worden gepakt.

## Bestanden

Nieuw:
- `src/lib/vastgoedrekenen/validation/caseRequirements.ts`
- `src/lib/vastgoedrekenen/validation/fieldStatus.ts`
- `src/lib/vastgoedrekenen/validation/reliability.ts`
- `src/lib/vastgoedrekenen/audit/calcChain.ts`
- `src/test/vastgoedrekenen/golden/fixtures.ts`
- `src/test/vastgoedrekenen/golden/compute.test.ts`

Aangepast:
- `src/lib/vastgoedrekenen/validation.ts` — gebruikt fieldStatus + caseRequirements
- `src/lib/vastgoedrekenen/audit/runAudit.ts` — voegt rekenketen + betrouwbaarheidsscore toe
- `src/components/vastgoedrekenen/audit/AuditDialog.tsx` — nieuwe tabs "Rekenketen" en "Betrouwbaarheid"
- `src/components/vastgoedrekenen/ResultaatKaart.tsx` — betrouwbaarheidsbadge + blocker-banner
- `src/components/vastgoedrekenen/ScenarioEditor.tsx` — "bewust 0"-markers voor kritieke kostenvelden
- `src/components/vastgoedrekenen/NogTeControleren.tsx` — toont casustype-header en gesplitste blockers/warnings

Niet aangeraakt:
- `compute.ts`, `investering.ts`, `huur.ts`, `verkoop.ts`, `bieding.ts`, `ovb.ts`, `wws.ts` (geen rekenwijzigingen)

## Acceptatiecriteria gecontroleerd

1. Verplichte velden per casustype centraal → caseRequirements
2. Gat zichtbaar bij missende velden → blocker-banner + fieldStatus
3. Geen stille 0 → fieldStatus onderscheid leeg vs bewust_nul
4. Max bieding herleidbaar → calcChain tab
5. Audit toont leidende bron → bestaande `sourcesOfTruth` + nieuwe rekenketen
6. Testcases bewijzen logica → 8 golden fixtures, Hinthamerstraat leidend
7. Gebruiker is niet enige controleur → betrouwbaarheidsscore + blockers
