# Fase 1 — Notariskosten & Bito aankoopfee-staffel

Strikt fase 1. **Geen** verkoopkosten, **geen** sale_costs_basis, **geen** Admin-CRUD, **geen** rekenrefactor. Bestaande scenario's blijven 1-op-1 doorrekenen.

## 0. Migratie (al uitgevoerd)

`ALTER TABLE calculation_scenarios` — drie kolommen toegevoegd, allemaal `DEFAULT 'manual'` zodat bestaande rijen ongewijzigd doorrekenen:
- `buyer_fee_method text` — CHECK `staffel|percentage|amount|manual|zero`
- `notary_costs_method text` — CHECK `profile|percentage|amount|manual|zero`
- `notary_costs_profile text` — CHECK `woning_simpel|woning_belegging|commercieel|mixed_use|portefeuille|NULL`

## 1. Nieuwe helpers (pure functions)

**`src/lib/vastgoedrekenen/fees/buyerFeeStaffel.ts`**
- `BITO_BUYER_FEE_TIERS` constant met exacte grenzen: `[0–1.000.000 → 2,0%]`, `[1.000.001–3.000.000 → 1,5%]`, `[3.000.001–∞ → 1,0%]`.
- `selectBuyerFeeTier(basis)` — kiest schijf; `1.000.000` → 2,0%, `3.000.000` → 1,5%, `3.000.001` → 1,0%.
- `resolveBuyerFeeBasis(scenario)` → `{ basis, source: 'beoogde_aankoopprijs' | 'vraagprijs' | 'ontbreekt' }` (voorkeur `purchase_price`, fallback `asking_price`).
- `computeBitoBuyerFee(scenario)` → `{ basis, basisSource, tier, pctExVat, vatPct, amountExVat, vatAmount, amountInclVat }`. Btw-pct uit `buyer_fee_vat_percentage` (default 21).

**`src/lib/vastgoedrekenen/fees/notaryProfile.ts`**
- `NOTARY_PROFILES`: 5 quickscan-profielen (min € + pct) volgens briefing; `portefeuille` heeft `requiresManual: true`.
- `computeNotaryFromProfile(basis, profileKey)` → `{ amount, formula: 'max(€2.000, basis × 0,10%)', minimum, pct, requiresManual }`.
- `defaultNotaryProfileFor(strategyType, objectType, unitsCount)` → kiest standaardprofiel voor nieuwe scenario's.

**`src/lib/vastgoedrekenen/fees/feeResolver.ts`** — bundelt resolutie voor compute & audit:
- `resolveEffectiveBuyerFee(scenario)` → `{ method, baseAmount, vatAmount, totalInclVat, basis, basisSource, tier, source: 'Bito-staffel'|'Handmatig'|'Bewust €0', warnings[] }`.
- `resolveEffectiveNotary(scenario)` → `{ method, amount, profile, basis, source, warnings[] }`.

## 2. Minimale wijziging in `investering.ts`

`computeAcquisitionCosts(scenario)` gebruikt vanaf nu de resolver:
- `buyer_fee_method === 'staffel'` → fee = staffel-resultaat (basis = beoogde aankoopprijs of vraagprijs).
- `buyer_fee_method === 'zero'` → 0.
- **Anders** (incl. `'manual'`, `'percentage'`, `'amount'`, of undefined) → **bestaande logica** (`buyer_fee_amount` of `purchase_price × buyer_fee_percentage`). Garanteert dat alle bestaande scenario's en golden tests ongewijzigd blijven.

Voor notariskosten:
- `notary_costs_method === 'profile'` + geldig `notary_costs_profile` → bedrag uit `computeNotaryFromProfile(basis)`.
- `notary_costs_method === 'zero'` → 0.
- Anders → bestaand `scenario.notary_costs ?? 0`.

Geen wijziging aan `computeTotalInvestment`, `computeTotalCosts`, OVB, NOI, max bod — die zien gewoon hogere/lagere `totalAcquisitionCosts` en rekenen verder identiek door.

## 3. UI — Aankoop & investering (`ScenarioEditor.tsx`)

Regels 1053-1054 vervangen door twee compacte methode-blokken. Hergebruik `Select`, `Badge` (bronchip), `ValueField`-patroon, `ManualZeroToggle`, `RawNumberInput`.

**Aankoopfee-blok:**
- Methode-select: Bito-staffel / Handmatig (%) / Handmatig (€) / Bewust €0.
- Bij staffel: read-only weergave van `basis`, `staffelregel`, `% ex. btw`, `fee ex. btw`, `btw`, `fee incl. btw` + bronchip "Bito-staffel".
- Bij handmatig: bestaande `NumZero`-velden voor `buyer_fee_percentage` / `buyer_fee_amount`. Chip "Handmatig" + knop **"Herstel Bito-staffel"** (zet method='staffel' en wist amount/pct).
- Waarschuwingstekst onder de regel bij fee €0 zonder bewust €0.

**Notariskosten-blok:**
- Methode-select: Automatisch profiel / % van koopsom / Vast bedrag / Handmatig / Bewust €0.
- Bij profiel: profiel-select (5 opties), read-only bedrag + formule `max(€2.000, basis × 0,10%)`, bronchip "Default quickscan: Beleggingswoning".
- Bij handmatig: bestaande `NumZero` voor `notary_costs`. Chip "Handmatig" + knop **"Herstel automatische default"**.
- Quickscan-waarschuwing onder de regel: *"Quickscan-default; controleer bij notaris/offerte vóór harde bieding."*

**Nieuwe scenario's** (`useVastgoedrekenen.tsx → createScenario`): default `buyer_fee_method: 'staffel'`, `notary_costs_method: 'profile'`, `notary_costs_profile: 'woning_belegging'`. **Bestaande scenario's blijven 'manual'.**

## 4. SaveGuards

`saveGuards.ts` — voeg `buyer_fee_method`, `notary_costs_method`, `notary_costs_profile` toe aan `PROTECTED_SCENARIO_FIELDS` zodat ze niet stilletjes leeglopen.

## 5. Audit (`audit/calcChain.ts`)

Vervang/splits het bestaande Aankoopkosten-blok (regels 82-89):
- **Aankoopfee-step**: methode, staffelregel, basis (`source: 'Basis: beoogde aankoopprijs'` etc), pct ex. btw, fee ex/btw/incl, bronchip; warn als fee=0 zonder bewust €0; warn als handmatige fee >5% afwijkt van Bito-staffel-uitkomst voor dezelfde basis.
- **Notariskosten-step**: methode, profielnaam, basis, bedrag, bron; warn bij €0 zonder bewust; warn bij `commercieel`/`mixed_use` met bedrag < profiel-minimum; advies-noot "Controleer bij notaris/offerte vóór harde bieding".
- **Overige aankoopkosten-step**: blijft bestaand pad (advies/dd/overig/safety margin) — zonder fee/notaris double-counting.

## 6. Tests

**`src/test/vastgoedrekenen/fees/buyerFeeStaffel.test.ts`** (nieuw):
- staffelgrenzen: € 1, € 1.000.000 → 2,0%; € 1.000.001 → 1,5%; € 3.000.000 → 1,5%; € 3.000.001 → 1,0%.
- voorbeeld € 2.300.000 → fee € 34.500, btw € 7.245, incl € 41.745.
- btw 21% standaard, override via `buyer_fee_vat_percentage`.
- `resolveBuyerFeeBasis`: purchase > 0 wint, anders asking, anders 'ontbreekt'.

**`src/test/vastgoedrekenen/fees/notaryProfile.test.ts`** (nieuw):
- simpel woning € 500k → max(2000, 500) = 2000.
- woning_belegging € 1M → max(2500, 1200) = 2500.
- commercieel € 4M → max(3500, 6000) = 6000.
- mixed_use € 2M → max(5000, 4000) = 5000.
- portefeuille → `requiresManual: true`.

**`src/test/vastgoedrekenen/fees/integration.test.ts`** (nieuw):
- `computeAcquisitionCosts` met `buyer_fee_method='staffel'` + purchase € 2,3M → buyerFeeBase 34.500, buyerFeeVat 7.245, totalAcquisitionCosts bevat 41.745.
- `buyer_fee_method='zero'` → fee = 0.
- bestaand scenario zonder method (treat as 'manual') → identieke uitkomst als vóór deze build.
- `notary_costs_method='profile'` + woning_belegging € 1M → totalAcquisitionCosts bevat 2500.
- `notary_costs_method='manual'` → bestaand `notary_costs` veld blijft leidend.
- fee incl. btw verhoogt `computeTotalInvestment` met exact het btw-bedrag.

**Bestaande 165 tests blijven groen** (default 'manual' = oude pad).

## 7. Geraakte bestanden

- migratie ✅ uitgevoerd
- `src/lib/vastgoedrekenen/fees/buyerFeeStaffel.ts` (nieuw)
- `src/lib/vastgoedrekenen/fees/notaryProfile.ts` (nieuw)
- `src/lib/vastgoedrekenen/fees/feeResolver.ts` (nieuw)
- `src/lib/vastgoedrekenen/investering.ts` (minimale edit `computeAcquisitionCosts`)
- `src/lib/vastgoedrekenen/saveGuards.ts` (3 veldnamen toevoegen)
- `src/lib/vastgoedrekenen/audit/calcChain.ts` (aankoopfee + notaris steps)
- `src/components/vastgoedrekenen/ScenarioEditor.tsx` (regels ~1053-1054 vervangen)
- `src/hooks/useVastgoedrekenen.tsx` (`createScenario` zet defaults voor nieuwe scenario's)
- `src/test/vastgoedrekenen/fees/*.test.ts` (3 nieuwe testfiles)

## 8. Rapportage na build

Aan het einde rapporteer ik: migratie ✓, helpers, save-guards, UI-aanpassingen, hoe fee incl. btw via `totalAcquisitionCosts` → `computeTotalInvestment` doorvloeit, hoe notariskosten via dezelfde route meetellen, lijst nieuwe tests, totaal aantal tests groen.
