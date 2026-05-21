## Vastgoedrekenen V1 — Verbeter- en stabilisatieronde

Doel: V1 consistent, begrijpelijk en praktisch bruikbaar maken. Geen nieuwe grote features (geen WWS V2, PDF/CSV, bouwkostenbibliotheek, IRR/DCF).

---

### 1. Centrale rekenlogica (één bron van waarheid)

- `src/lib/vastgoedrekenen/compute.ts` blijft enige engine.
- `ScenarioVergelijking` gebruikt **exact dezelfde** `computeScenario()` output als `DealSnapshot` — geen aparte fallback-aannames meer.
- Refactor `useScenarioChildren` aanroepen zodat overzicht en detail één hook delen met dezelfde inputs (rentChoice, OVB-mode, aannameprofiel, kostenstructuur).
- Uniforme termen overal: **Totale investering**, **BAR op totale investering**, **Factor op totale investering**, **Maximale bieding** (term "Max bod" verwijderen uit alle UI).

### 2. Verschil met vraagprijs

- Formule: `verschil = maximaleBieding - vraagprijs`.
- UI toont één van twee labels met kleur:
  - `verschil >= 0`: "Biedingsruimte boven vraagprijs" (groen, `+ €…`)
  - `verschil < 0`: "Benodigde prijsverlaging" (amber, `- €…`)
- `differenceWithAskingPrice` in `ComputedOutputs` herzien (huidige formule gebruikt `realisticBid`, moet `maximumBid` worden).

### 3. OVB-modus volledig werkend

- **Automatisch**: scenario.ovb_classification → percentage uit tax_settings; toon `pct` + bedrag.
- **Per component**: UI in `ScenarioEditor` toont per component OVB-velden (waarde, classification, %, bedrag, methode); m²-fallback met waarschuwing; ontbrekend → blocker-waarschuwing.
- **Handmatig**: `transfer_tax_percentage` en `transfer_tax_amount` invulbaar; bedrag is leidend; gele waarschuwing zichtbaar.
- Gekozen modus werkt door in Snapshot, totale investering, BAR, factor, max bieding én vergelijking.

### 4. Velden, eenheden, suffixes

- Alle inputs in `ScenarioEditor` krijgen suffix `€`, `%`, `m²` of `maanden` en duidelijke labels + placeholders.

### 5–7. Aannameprofielen per vastgoedtype

- Nieuw bestand `src/lib/vastgoedrekenen/profiles.ts` met profielen (Licht/Normaal/Conservatief/Zwaar/Handmatig) per type: residentieel, mixed-use, retail, kantoor, bedrijfsruimte, logistiek, zorg.
- Scenario krijgt nieuwe velden (zie §16) opgeslagen in `notes` JSON of als nieuwe kolommen. **Keuze:** nieuwe kolommen via migratie (`assumption_profile`, `assumption_profile_reason`, `cost_structure`, `incentive_reserve`, `mjop_present`, `contract_checked`, `service_costs_checked`, `assumptions_manual`, `assumptions_source`, `assumptions_reliability`, `rent_source`).
- Default profiel bepaald door objecttype/strategie (transformatie→Zwaar, uitponden→Conservatief, retail/kantoor/mixed-use→Conservatief, residentieel→Normaal).
- Helptekst boven Huuranalyse, profiel-selector wijzigt de 5 percentages live.

### 8. Bruto → NOI opbouw

- Nieuwe component `NoiOpbouw.tsx`: tabel met bruto jaarhuur → correcties (% én €) → NOI, NOI-marge, BAR bruto, NAR.
- `NAR = NOI / totalInvestment × 100` toegevoegd aan `ComputedOutputs`.

### 9. Huurbron

- Nieuw veld `rent_source`: `handmatig | componenten | wws_gecorrigeerd | handmatig_gecorrigeerd`.
- Bij `componenten`: huidige + markthuur opgeteld uit `calculation_components.current_monthly_rent` / `market_monthly_rent`.

### 10. Kostenstructuur

- Veld `cost_structure` met 5 opties; bij triple-net/huurder-draagt: helptekst + handmatige aanpassing toegestaan zonder auto-verlaging; bij onbekend + commercieel: forceer minimaal Conservatief.

### 11. Componenten/units praktischer

- Helptekst boven sectie.
- Componenten-velden uitklapbaar (Collapsible) met optionele extra's.
- Doorwerking in huurtotalen via huurbron `componenten`.

### 12. WWS koppelen aan wooncomponenten

- Waarschuwing als type woning/appartement zonder WWS-units.
- Knop "Maak WWS-units aan uit wooncomponenten" — kopieert naam, GBO, huur, WOZ, label.

### 13. Rekenbasis-balk

- `RekenbasisBar.tsx` boven Snapshot: huurbron, aannameprofiel, huurtype, OVB-modus, kostenstructuur, gewenste BAR, inputbetrouwbaarheid.

### 14–15. Validatie & waarschuwingen

- `validation.ts`: bouwt "Nog te controleren" lijst (WWS ontbreekt, OVB mixed-use, componentwaarden, contracten, label, WOZ, kostenstructuur, MJOP, contractduur).
- Aannamewaarschuwingen volgens 10 regels in §15.

### 17. Opslagstatus

- `ScenarioEditor` toont "Niet opgeslagen / Laatst opgeslagen: …" en "Berekeningen bijgewerkt" badge. Live compute blijft client-side; vergelijking gebruikt dezelfde live engine.

### 18. Quickscan defaults

- Sectie "Quickscan defaults" inklapbaar in editor toont actieve defaults + uitlegtekst. Aankoopfee default = 2% (consistent met `VR_DEFAULTS`).

### 19. Uitponden / transformatie

- Strategie-afhankelijke banner in Snapshot.
- Bij `uitponden`: max bieding-alt-berekening (netto uitpondopbrengst − marge) als extra getal naast huur-based; visueel labelen welke leidend is.
- Bij `transformeren`: waarschuwingen bij ontbrekende transformatiekosten/vergunning/exit.

---

### Database migratie (nieuwe kolommen `calculation_scenarios`)

```
ALTER TABLE calculation_scenarios ADD COLUMN:
  assumption_profile text DEFAULT 'conservatief',
  assumption_profile_reason text,
  assumptions_manual boolean DEFAULT false,
  assumptions_source text,
  assumptions_reliability text DEFAULT 'middel',
  cost_structure text DEFAULT 'onbekend',
  incentive_reserve boolean DEFAULT false,
  mjop_present text DEFAULT 'onbekend',
  contract_checked boolean DEFAULT false,
  service_costs_checked boolean DEFAULT false,
  rent_source text DEFAULT 'handmatig'
```

### Bestanden

**Nieuw:**
- `src/lib/vastgoedrekenen/profiles.ts` — aannameprofielen per type
- `src/lib/vastgoedrekenen/validation.ts` — "nog te controleren" + waarschuwingen §15
- `src/components/vastgoedrekenen/RekenbasisBar.tsx`
- `src/components/vastgoedrekenen/NoiOpbouw.tsx`
- `src/components/vastgoedrekenen/NogTeControleren.tsx`
- `src/components/vastgoedrekenen/AannameProfielSelect.tsx`
- `src/components/vastgoedrekenen/OvbModusSectie.tsx` (per-component + handmatig UI)
- `src/components/vastgoedrekenen/QuickscanDefaults.tsx`

**Aanpassen:**
- `src/lib/vastgoedrekenen/compute.ts` — NAR, differenceWithAskingPrice met maxBid, profiel toegepast, uitpond/transformatie-paden
- `src/lib/vastgoedrekenen/types.ts` — nieuwe velden + NAR
- `src/lib/vastgoedrekenen/huur.ts` — huurbron `componenten`
- `src/lib/vastgoedrekenen/defaults.ts` — terminologie
- `src/components/vastgoedrekenen/ScenarioEditor.tsx` — eenheden, OVB, huurbron, profiel, kostenstructuur, opslagstatus
- `src/components/vastgoedrekenen/DealSnapshot.tsx` — Verschil met vraagprijs, NAR, term "Maximale bieding"
- `src/components/vastgoedrekenen/ScenarioVergelijking.tsx` — zelfde compute, term-uniformiteit
- `src/components/vastgoedrekenen/VastgoedrekenenTab.tsx` — Rekenbasis + Nog te controleren bovenaan
- `src/hooks/useVastgoedrekenen.tsx` — nieuwe velden in CRUD

### Out of scope (later)
WWS V2, PDF/CSV-export, bouwkostenbibliotheek, IRR/DCF, uitgebreide financiering, marktdata-koppelingen.
