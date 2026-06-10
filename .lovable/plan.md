# Plan: App-brede decimal-proof rekenvelden

## Doel
Alle rekenkundige numerieke velden in Vastgoedrekenen, objecten, componenten, WWS en scenario’s slaan, tonen, importeren en berekenen waarden met decimalen. Afronding mag uitsluitend visueel plaatsvinden — nooit in opslag of berekening.

## Diagnose (huidige situatie)

**Database — integer-kolommen voor metrages (foutgevoelig):**
- `objecten`: `oppervlakte`, `oppervlakte_gbo`, `oppervlakte_vvo`, `oppervlakte_bvo`, `perceel_oppervlakte`
- `calculation_components`: `surface_gbo`, `surface_vvo`, `surface_bvo`
- `sell_off_units`: `surface_gbo`, `surface_vvo`, `surface_bvo`
- `residential_wws_units`: `living_area_m2`, `other_indoor_space_m2`, `outdoor_space_m2`
- `object_huurders`: `oppervlakte_m2`
- `object_huur_metrics`: `verhuurde_m2`
- `referentie_objecten`: `m2`
- `zoekprofielen`: `oppervlakte_min`, `oppervlakte_max`

**Database — bigint voor bedragen (OK, blijven in hele euro’s):**
Alle `*_costs`, `*_price`, `*_rent`, `*_bid`, `*_amount`, `*_investment`, etc. zijn `bigint`. Dit is bewust gekozen als "hele euro’s" en is app-breed consistent. Geen schemawijziging nodig; wel handhaven dat parsing decimaal accepteert en afrondt naar hele euro vóór opslag.

**Database — numeric voor percentages/factors (OK):**
Reeds `numeric` zonder vaste schaal. Geen wijziging nodig.

**Code — knelpunten:**
- `parseInt` / `Math.round` / `Math.trunc` in oppervlakte-velden in `ObjectFormDialog`, `HuurdersPanel`, componenttabellen en WWS-units → decimalen worden afgekapt.
- `NumberField` met `integer` flag wordt op metrages gebruikt.
- Import-/bulk-paden (`ComponentenTable`, bulkfill) ronden m² af.

## Doelarchitectuur

**Conventie per veldsoort:**

| Veldsoort | Opslag | Parsing | UI (detail) | UI (compact) |
|---|---|---|---|---|
| Metrages (m²) | `numeric(14,2)` | komma+punt, € en m² gestript | `85,40 m²` | `85 m²` (alleen visueel) |
| Lengtes (m) | `numeric(10,2)` | idem | `2,70 m` | — |
| Bedragen (€) | `bigint` (hele €) | decimaal toegestaan, intern `Math.round` | `€ 818.432` | `€ 818k` (visueel) |
| Percentages | `numeric` | komma+punt, % gestript | `5,75%` | `5,8%` |
| WWS-punten | `numeric(10,2)` waar relevant | idem | `127,5` | — |
| Tellingen (units, kamers, bouwjaar) | `integer` | `parseInt` toegestaan | heel getal | — |

## Werkpakketten

### Fase 1 — DB-migratie metrages naar `numeric`
Eén migratie die alle bovengenoemde integer-metragekolommen converteert naar `numeric(14,2)`. Bestaande waarden blijven behouden (cast int→numeric is verliesvrij). `types.ts` wordt automatisch opnieuw gegenereerd.

Kolommen:
```
objecten.oppervlakte, oppervlakte_gbo, oppervlakte_vvo, oppervlakte_bvo, perceel_oppervlakte
calculation_components.surface_gbo, surface_vvo, surface_bvo
sell_off_units.surface_gbo, surface_vvo, surface_bvo
residential_wws_units.living_area_m2, other_indoor_space_m2, outdoor_space_m2
object_huurders.oppervlakte_m2
object_huur_metrics.verhuurde_m2
referentie_objecten.m2
zoekprofielen.oppervlakte_min, oppervlakte_max
```
Geen datamigratie nodig (decimalen die al verloren zijn, blijven verloren — er komt een controle-query als rapport).

### Fase 2 — Parser- en UI-laag
- `NumberField`: bevestig decimaal-default (al aanwezig). Verwijder `integer`-flag op alle metrageveld-call-sites.
- Centrale helper `parseEuroBigint(raw): number | undefined` die decimaal accepteert en afrondt vóór opslag (bigint blijft euro’s). Vervangt rauwe `parseInt`/`Number(...)` in bedragvelden.
- `formatM2` (al aanwezig) gebruiken in alle weergaves; nooit `Math.round(m2)` vóór formattering.

### Fase 3 — Code-refactor (app-breed)
- `src/components/forms/ObjectFormDialog.tsx`: oppervlaktes → `NumberField decimals={2}` (geen `integer`).
- `src/components/object/HuurdersPanel.tsx`: `oppervlakte_m2` → decimal.
- `src/components/vastgoedrekenen/cockpit/ComponentenTable.tsx` + `ComponentStrategyTable.tsx`: `surface_*` invoer + weergave decimal.
- `src/components/vastgoedrekenen/cockpit/WwsUnitsTable.tsx`: `living_area_m2`, `other_indoor_space_m2`, `outdoor_space_m2` decimal.
- `src/pages/ReferentieObjectenPage.tsx` + `ReferentieObjectFormDialog.tsx`: `m2` decimal.
- `src/components/forms/ZoekprofielFormDialog.tsx`: `oppervlakte_min/max` decimal.
- WWS-, NOI-, en investeringsberekeningen (`src/lib/vastgoedrekenen/*`): controleren dat ze al floats gebruiken (zo ja, geen wijziging). Geen rekenlogica wijzigen — alleen typecontract.
- Sweep op `parseInt(` in `src/` voor numerieke invoer; behoud alleen bij echte tellingen (units, kamers, jaartal).

### Fase 4 — Import & bulk
- `BulkFillDialog` en eventuele import-paden gebruiken `parseDutchNumber`; verifieer dat geen `parseInt` of `Math.round` wordt toegepast op m².

### Fase 5 — Tests
Uitbreiden van `src/test/ui/numberField.test.ts` en toevoegen integratietest:
- `85,40` / `85.40` / `111,81` → opslag met decimaal behoud
- WWS-doorrekening met decimal `living_area_m2`
- Componentstrategie totaal m² met decimalen (Hinthamerstraat-cases: 470,00 / 149,10 / 559,00)
- Bedragparser: `€ 818.432,50` → `818433` (bigint, hele euro)
- Percentage parser: `5,75%` → `5.75`

Acceptatie: alle bestaande 200 tests blijven groen + nieuwe tests groen.

## Buiten scope deze ronde
- Bedragen omzetten naar cents-storage (geen netto winst, brede impact).
- Restauratie van reeds afgekapte waarden in bestaande records (niet mogelijk uit data zelf; per object handmatig of via her-import).
- UI-restyle, nieuwe modules.

## Risico’s & mitigatie
- **Type-regeneratie**: na de migratie veranderen velden van `number` (int) naar `number` (numeric, nog steeds JS `number`). TS-impact is minimaal; rechtstreekse `parseInt(value)` op die kolommen moet weg.
- **Stille afronding via UI**: alle aangepaste velden krijgen `decimals={2}` op `NumberField`, anders blijft `Math.trunc` actief.
- **Bedragenveld-acceptatie**: een gebruiker die `€ 1.625.000,50` invoert wordt opgeslagen als `1625001` (hele euro). Dit is bewust en consistent met bestaande bigint-keuze; weergave blijft `€ 1.625.001`.
- **WWS-rekenwijzigingen**: er wordt geen formule aangepast. Alleen invoer-precisie verbetert.

## Rapportage na afloop
- Lijst van geconverteerde kolommen
- Lijst van aangepaste UI-componenten
- Aantal weggewerkte `parseInt`-call-sites op rekenvelden
- Hinthamerstraat-cases: 92A=85,40 / 92B=68,90 / … en totalen 470,00 / 149,10 / 559,00 in storage en UI
- Totaal aantal tests groen

Bij akkoord begin ik met Fase 1 (DB-migratie) — die wordt ter goedkeuring voorgelegd voor uitvoering.

---

## Prompt 3.7 — Notificaties gecontroleerd en gecentraliseerd

Uitgevoerd: review en lichte aanscherping van `src/components/NotificationsBell.tsx`.

### Toegestane notificatietriggers (vastgelegd)
- **Taken**: verlopen (kritiek), deadline vandaag (hoog), nieuwe taak met hoog/urgente prioriteit (hoog).
- **Biedingen**: bod verloopt vandaag of morgen (hoog), alleen actieve statussen.
- **Matching**: nieuwe sterke match — drempel via `STRONG_MATCH_THRESHOLD = 70` (`isStrongMatch`).
- **Datakwaliteit**: mogelijke dubbele relatie (kritiek), mogelijke dubbele objectinvoer (kritiek).
- Geen andere triggers actief. `pushNotification` is publieke API maar wordt nergens extern aangeroepen.

### Centrale helpers in gebruik
- Sterke match: `isStrongMatch` / `STRONG_MATCH_THRESHOLD` uit `@/lib/derivations` (geen hardcoded `>= 5`).
- Taken: `isTaakTeLaat`, `isTaakVandaag` uit `@/lib/taakHelpers`.
- Biedingen: `useBiedingen({ all: true })` — zelfde bron als Biedingen-sectie.
- Relatie display: `getRelatieNaamCompact`, `getRelationDisplayName` uit `@/lib/relatieNaam`.

### Init / seen / dedupe
- `INIT_FLAG = 'bito-notifications-initialized-v3'`: bij eerste init worden alle huidige kandidaten als gezien gemarkeerd → geen backfill-stortvloed.
- `CREATED_IDS_KEY`: persistente set van reeds gegenereerde notificatie-id's (cap 2000) — voorkomt herverschijnen na wissen.
- Dedupe-key per trigger:
  - `taak-verlopen::<id>`
  - `taak-vandaag::<id>::<YYYY-MM-DD>` (per dag uniek)
  - `taak-hoogprio::<id>`
  - `bod-verloop::<id>::<datum>`
  - `match-sterk::<objectId>::<zoekprofielId>`
  - `dupe-relatie::<key>` / `dupe-object::<key>`

### Labels (kort, actiegericht)
"Taak verlopen", "Taak verloopt vandaag", "Hoge prioriteitstaak"/"Urgente taak", "Bod verloopt vandaag/morgen", "Sterke match gevonden", "Mogelijke dubbele relatie", "Mogelijke dubbele objectinvoer". Entiteitsnaam + datum/tijd in body.

### Tests
- `src/test/notifications.test.ts`: drempel 69/70, 5 ≠ sterk, bod-venster vandaag/morgen vs. 3 dagen/gisteren.
- Bestaande `src/test/derivations/matching.test.ts` dekt `isStrongMatch`.

### Niet gewijzigd
- Geen schemawijzigingen, geen datamigraties, geen nieuwe notificatietypes, geen UI-redesign.
- Read/clear-acties en persistentie via localStorage onveranderd.

### Open punten (later)
- Optioneel: server-side notificatiestore voor cross-device sync.
- Optioneel: trigger "taak aan mij gekoppeld" zodra rol-toewijzing op taken actief wordt.

---

## Prompt 3.9 — Eindcontrole Fase 3

### Build / tests
- TypeScript/build: schoon (geen errors).
- Vitest: **452 tests groen, 34 testfiles** (incl. Fase 3 helpers, notificaties, biedingen, relatieNaam, numberField, derivations).

### Gecontroleerde onderdelen

**Matching**
- Sweep `score >= 5` / `score > 4` / `STRONG_MATCH_MIN`: 0 hits in `src/` en `supabase/`.
- Alle sterke-match checks via `isStrongMatch` / `STRONG_MATCH_THRESHOLD = 70`.

**Verhuur**
- Hero, Financieel- en Verhuur-sectie in `ObjectDetailPage` gebruiken `deriveVerhuurMetrics` voor aantal/WALT/mismatch-banner.
- `object.huurinkomsten`-reads die overblijven (regels 821/826/834/835/839 in `ObjectDetailPage`) zijn legitieme **bron**-velden voor `resolveBAR/NAR/NOI`/`calculateFactor`/`calculateMonthlyRent`/`calculateRentPerM2` — geen dubbele jaarhuur.
- Mismatch-banner toont verschil object vs. huurderslijst.

**Financieel**
- BAR/NAR/factor/huur/m²/maandhuur via `@/lib/derivations/financial` (auto + override).
- `prijsindicatie` wordt nergens gebruikt voor rendement (zie comment in `financial.ts`).
- Geen NaN/Infinity-paden: `safeNumber`/`safeDivide` filtert alles.

**ObjectFormDialog**
- Actieve tab wordt vastgehouden (zie eerdere fix); `initialTab` blijft werken via prop.
- Numerieke velden via `NumberField` accepteren komma + punt.
- Mobile font-size ≥ 16px via centrale CSS — geen iOS auto-zoom.

**Dossier / Documenten / Media**
- `DossierReadiness` is leidend; `documentenBeschikbaar`/`documentatieStatus` zijn IM-presentatieflags, geen dossierstatus.
- Foto's / Plattegronden / Documenten blijven gescheiden via `object_fotos.categorie` + `object_documenten`.

**Notificaties**
- Triggerlijst beperkt tot 5 categorieën (taken, biedingen, matching, dupes).
- `INIT_FLAG`, `CREATED_IDS_KEY` en dedupe-keys actief; gewiste meldingen komen niet terug door dezelfde trigger.
- Sterke-match notificatie gebruikt `isStrongMatch` (drempel 70).
- Labels: kort en actiegericht ("Taak verloopt vandaag", "Sterke match gevonden", "Bod verloopt morgen").

**iCal-feed (`bito-ical-feed`)**
- Geen "Onbekend" in titels/notities; primaire contactpersoon-fallback werkt.
- `humanizeFaseInline` zet `interesse_ontvangen` → "Interesse ontvangen".

**Deal Cockpit / pipeline / biedingen**
- Lead deal via `selectLeadDeal`, verwachte fee via `calculateExpectedFee`, kandidaatcount via `countKandidaten` — alle uit `@/lib/derivations/deal`.
- Biedbedragen via Dutch parser; `offerAmountParse.test.ts` dekt `1.350.000` → 1350000.

### Kleine fixes deze ronde
- Geen — geen regressies of oude drempels gevonden.

### Bewust niet aangepakt (uit 3.8-audit, voor latere prompts)
- 3.8A taxonomie fallback-helper.
- 3.8B financiële override-chips uniform op hero/IM/cockpit.
- 3.8C legacy `financieleScenarios` read-only met "snapshot"-badge.
- 3.8D `documentenBeschikbaar`/`documentatieStatus` uitfaseren in IM-UI.
- 3.8E `humanizeFase` + `FASE_LABEL` centraliseren (nu inline in iCal edge function).
- Eventuele rebrand van legacy `relatie.contactpersoon` writes.

### Open punten uit 3.8
1. `object.huurPerM2` afschaffen als opgeslagen veld? (nu: blijft als override)
2. Bij save automatisch legacy `type`/`subcategorie` afleiden uit `propertyTypeId`? (nu: niet)
3. PDF-voorrang `marktwaardeIndicatie` vs. referentie-mediaan?
4. Tolerantie BAR/NAR-override (0.2% vs. 0.5%)?
5. Handmatige import `financieleScenarios` → `calculation_scenarios`?

### Conclusie
**Fase 3 technisch afgerond.** Alle centrale helpers in gebruik, tests groen, geen oude drempels of dubbele jaarhuur, notificaties beperkt en gededupliceerd, iCal en relatie-display schoon. Vervolgwerk staat opgeschreven als 3.8A–3.8G voor latere prompts.
