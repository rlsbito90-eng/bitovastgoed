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

---

## Fase 4A.1 — QuickCreateRelationDialog (standalone)

### Status
Uitgevoerd. Standalone component + tests. **Nog niet geïntegreerd** in
KandidaatSelectieDialog, EntityPicker, ObjectFormDialog, OfferFormDialog,
ContactMomentFormDialog, TaakFormDialog of DealFormDialog.

### Component
- Locatie: `src/components/forms/QuickCreateRelationDialog.tsx`
- Default export + named export `QuickCreateRelationDialog`.

### Props
- `open: boolean`
- `onOpenChange(open)`
- `context?: 'verkoper' | 'kandidaat' | 'bieder' | 'contact' | 'taak' | 'deal' | 'algemeen'` (default `'algemeen'`)
- `defaultValues?: { naam?, bedrijfsnaam?, email?, telefoon?, type? }`
- `onCreated(relatie)` — wordt ook aangeroepen bij "Kies deze" op een duplicate-hit.
- `onCancel?()`

### Velden (V1, geen "Meer")
- Naam / contactpersoon
- Bedrijfsnaam
- E-mail (inputMode=email)
- Telefoon (inputMode=tel)
- Partijtype (select, default per context)

### Default partijtype per context
- `verkoper` → eigenaar
- `kandidaat` / `bieder` / `deal` → belegger
- `contact` / `taak` / `algemeen` → overig

### Validatie en placeholder-logica
- Minimaal één van naam, bedrijfsnaam, e-mail, telefoon vereist.
- "Onbekend", "onbekende relatie", "naamloos", "-", "–" tellen als leeg en
  worden nooit opgeslagen (zelfde set als `getRelatieNamen`).
- Alle velden trimmed; lege strings → lege string in store (consistent met
  bestaande `Relatie`-type).

### Aanmaken
- Gebruikt `useDataStore().addRelatie` met `leadStatus: 'lauw'`, `regio: []`,
  `assetClasses: []`, `ndaGetekend: false`.
- Slaat schone naam ook op in legacy `relatie.contactpersoon` voor backwards
  compat met bestaande displays.
- Maakt primaire `RelatieContactpersoon` aan (`isPrimair: true`,
  `decisionMaker: false`, `voorkeurTaal: 'nl'`) als naam is ingevuld.
- Faal van contactpersoon-create logt warning maar laat relatie-create intact.
- Bij succes: `toast.success('Relatie aangemaakt.')`, `onCreated(nieuw)`,
  sluit dialog.

### Duplicate-hint V1
- Strict: e-mail exact match (case-insensitive) of telefoon match op alleen
  cijfers (`/\D+/g` gestript).
- Toont amber alert "Mogelijk bestaat deze relatie al." met max 3 hits via
  `getRelatieDropdownLabel`.
- Per hit een "Kies deze"-knop die `onCreated(bestaande)` aanroept zonder
  nieuwe relatie te maken.
- Geen naam/fuzzy matching, geen merge-flow.

### UI/UX
- Compacte dialog `max-w-md w-[95vw]`, geen tabs, mobile-first.
- Hergebruikt shadcn `Input`/`Select` (16px font, dus geen iOS auto-zoom).
- Primaire knop "Relatie aanmaken", secundair "Annuleren", disabled tijdens save.
- Validatiefout zichtbaar als `text-destructive` met `role="alert"`.

### Tests
- `src/test/forms/quickCreateRelationDialog.test.tsx` — 10 tests, allemaal groen.
- Mockt `useDataStore` en `sonner`.
- Dekt: titel, lege validatie, alleen-naam create + contactpersoon, alleen
  bedrijfsnaam (geen contactpersoon), alleen e-mail, "Onbekend" als leeg,
  default `eigenaar` voor `verkoper`, duplicate-hint op e-mail, duplicate-hint
  op telefoon, geen hint bij alleen naam-overlap.

### Volgende stap
4A.2 — Integratie in `KandidaatSelectieDialog` als "+ Nieuwe relatie"-CTA
wanneer zoekresultaat leeg is.

---

## Fase 4A.2 — Integratie in KandidaatSelectieDialog

### Status
Uitgevoerd. Alleen `KandidaatSelectieDialog` integreert nu QuickCreate.
EntityPicker, ObjectFormDialog, OfferFormDialog, ContactMomentFormDialog,
TaakFormDialog en DealFormDialog blijven ongewijzigd voor latere stappen.

### Wijzigingen
- `src/components/pipeline/KandidaatSelectieDialog.tsx`
  - Import `QuickCreateRelationDialog` + `UserPlus` icoon.
  - State `quickOpen` met reset bij heropenen.
  - "+ Nieuwe relatie" link in de filterbalk (subtiel, naast de
    "X gevonden · Y geselecteerd"-teller).
  - Lege-resultaat-CTA "Nieuwe relatie aanmaken" als de lijst leeg is
    (zowel met filters actief als zonder relaties).
  - `handleQuickCreated(r)` voegt nieuwe relatie toe aan `geselecteerd`
    zonder bestaande selectie te verstoren, leegt de zoekterm zodat de
    nieuwe relatie zichtbaar wordt en toont een toast met de display-naam.
  - `quickDefaults` leidt slimme defaults af uit de zoekterm:
    bevat `@` → email; cijfer/telefoonpatroon → telefoon; anders naam.
  - QuickCreate dialog gerenderd binnen de outer Dialog (nested), context
    `kandidaat` → default partijtype `belegger`.

### UX-keuzes
- Workflow blijft intact: `KandidaatSelectieDialog` sluit niet bij quick
  create; gebruiker kan direct doorklikken op "Toevoegen (n)".
- Bestaande selectie blijft behouden; nieuwe relatie wordt automatisch
  bovenop de bestaande selectie gezet.
- Zoekterm wordt geleegd zodat de nieuw aangemaakte relatie zichtbaar is
  in de lijst (lijst filtert ook op `reedsGekoppeld`, dus alleen écht
  nieuwe relaties verschijnen).
- Geen wijzigingen aan zoekveld-gedrag, clear-knop of mobiele kaartlijst.

### Tests
- Volledige suite groen: 462/462 (35 testfiles).
- Geen aparte interactietest voor de dialog-in-dialog flow toegevoegd:
  het complexe radix-portal/nested-dialog gedrag is fragiel om te
  unittesten en de standalone `QuickCreateRelationDialog` heeft eigen
  10/10 dekking voor de create-flow zelf.

### Volgende stap
4A.3 — "+ Nieuwe relatie"-CTA in `EntityPicker` zodat OfferFormDialog,
ContactMomentFormDialog, TaakFormDialog en DealFormDialog tegelijk mee
profiteren.

---

# Fase 4K — Kadaster-integratie (Objectinformatie API)

Plan-only. Geen code-, schema- of datawijzigingen in deze ronde.
De API-key zelf wordt niet in plan.md, code, frontend of logs vastgelegd.

## 1. Doel en scope

Voorzichtige, gefaseerde integratie met de Kadaster/Kadata
Objectinformatie API. Gebruiker krijgt op aanvraag (nooit automatisch)
Kadaster- en gebiedsdata bij een Object of Off-market Signaal, ziet
eerst kosten + preview en kiest daarna handmatig welke velden naar het
CRM worden overgenomen.

**V1 in scope**
- Edge Function `kadaster-objectinformatie` als enige plek met API-key.
- Knop "Kadastergegevens ophalen" in ObjectFormDialog/Objectdetail en in
  Off-market Signaal-detail.
- Betaalde producten V1: `object` (WOZ-object, ±€ 0,10) en `waarde`
  (Koopsom, ±€ 0,10) met `deliver = withoutProduct`.
- Gratis producten V1: gemeentelijke lasten + buurtstatistieken
  (zonder kostenconfirmatie, wél expliciete klik).
- Postcode + huisnummer (+ optioneel huisletter/toevoeging) als
  primaire input. BAG-ID alleen optioneel/geavanceerd.
- Bij meerdere huisnummers: gebruiker kiest één huisnummer vóór call.
- Preview-dialog met per-veld of per-groep "Overnemen"; nooit
  automatisch overschrijven.
- Foutafhandeling met duidelijke NL-meldingen (401/406, 412, 404,
  409/422, 500).

**Expliciet niet in V1**
- Product `rechten` / eigendomsinformatie (V2, aparte knop/bevestiging).
- PDF-opslag, Kadasterkaart, Woningrapport, Product API (V3).
- Bulk-enrichment, background sync, automatische datamigratie.
- Volledige Instellingen → Integraties → Kadaster beheerpagina (alleen
  ontwerp; minimale status-indicatie kan later).
- Automatische call bij page load, opslaan of adreswijziging.

## 2. API-overzicht

**Endpoints**
- `GET  /objectinformatieapi/api/v1/products` — productcatalogus
  (alleen later/beheer; niet in V1 UI).
- `POST /objectinformatieapi/api/v1/report` — feitelijke aanvraag.

**Request (relevant)**
- `pht.postalcode`, `pht.houseNumber`, `pht.houseLetter`,
  `pht.houseNumberAddition`, of `bagId`.
- `selection[]` met `{ code, deliver }`.
- `includePdf` (false in V1), `efacReferentie`, `efacOrderNr`
  (optioneel, voor latere kostenadministratie).

**Productcodes V1**
- `object` — WOZ-object, ±€ 0,10, `deliver: withoutProduct`.
- `waarde` — Koopsom, ±€ 0,10, `deliver: withoutProduct`.

**Gratis producten V1**
- Gemeentelijke lasten (OZB, reinigingsrechten, rioolheffing).
- Buurtstatistieken (inwoners, leeftijd, huishoudens, oppervlakte,
  stedelijkheid, etc.).
- Worden in dezelfde call meegevraagd of in een aparte "Gebiedsdata
  ophalen"-knop, afhankelijk van open beslissing 1.

**V2/later**
- `rechten` — Eigendomsinformatie, ±€ 2,40, `deliver: onlyComplete`,
  aparte knop, aparte bevestiging.

## 3. Architectuur

```text
Frontend (React)
  └─ "Kadastergegevens ophalen" knop
       ├─ Kostenconfirmatie dialog (alleen betaalde producten)
       └─ supabase.functions.invoke('kadaster-objectinformatie', { ... })
              │
              ▼
       Edge Function `kadaster-objectinformatie`
         - JWT-check + interne-rol-check (admin/medewerker)
         - Input-validatie (zod): postcode/huisnummer of bagId
         - Leest KADASTER_OBJECTINFORMATIE_API_KEY uit Secrets
         - Bouwt POST /report met selection[]
         - Normaliseert response → veilig DTO
         - Logt metadata (productcodes, status, timestamp,
           kostenindicatie, objectId/signaalId) — nooit de key
         - Geeft genormaliseerde preview terug
              │
              ▼
       Frontend Preview-dialog
         - Per veld/groep "Overnemen" naar CRM
         - Bron + opgehaald-op + productcodes zichtbaar
```

**Security**
- API-key uitsluitend in Supabase Secret
  `KADASTER_OBJECTINFORMATIE_API_KEY`.
- Geen key in frontend, geen key in logs, geen key in plan.md.
- Endpoint alleen voor ingelogde interne gebruikers
  (`is_intern_gebruiker`).
- Dubbele-klik preventie + minimale rate limit (bv. 1 call per object
  per N seconden) om dubbele betaalde calls te voorkomen.
- Geen automatische retry bij 4xx; bij 5xx maximaal 1 stille retry zonder
  nieuwe kosten te riskeren (alleen idempotent error-path).

## 4. API-key & expiry

- Key wordt door beheerder als Supabase Secret gezet:
  `KADASTER_OBJECTINFORMATIE_API_KEY`. Geldigheid maximaal 3 maanden.
  Einddatum wordt apart bijgehouden (open beslissing 4).
- Edge Function vertaalt Kadaster-foutcodes naar NL-meldingen:
  - 401/406 → "Kadaster API-key is ongeldig of verlopen. Verleng of
    vervang de API-key in Supabase Secrets."
  - 412 → "Kadaster-bestedingsruimte is overschreden. Controleer de
    instellingen in Kadaster/Kadata."
  - 404 → "Geen Kadasterobject gevonden voor dit adres."
  - 409/422 → "Aanvraag ongeldig (product of adres niet geaccepteerd)."
  - 500/503 → "Kadaster is tijdelijk niet beschikbaar. Probeer later
    opnieuw."
- Latere beheer/statuskaart (ontwerp, niet bouwen in V1):
  Instellingen → Integraties → Kadaster met status (niet ingesteld /
  actief / fout / verloopt binnenkort / verlopen), handmatig vastgelegde
  einddatum, laatste succesvolle aanvraag, laatste foutmelding,
  reminder 14 dagen vóór verloop.

## 5. Kostenbewaking

- Geen automatische bevragingen — call vereist altijd expliciete klik.
- Betaalde call (object + waarde):
  - Kostenconfirmatie dialog vóór elke call ("Geschatte kosten: € 0,20
    — object € 0,10 + waarde € 0,10. Doorgaan?").
  - Bevestigingstekst toont gekozen adres zodat fout adres niet
    onbedoeld betaald wordt.
- Gratis call (gemeentelijke lasten + buurtstatistieken):
  - Geen kostenconfirmatie; wel expliciete knop, geen autoload.
- `rechten` (V2): aparte knop "Eigendomsinformatie ophalen (€ 2,40)",
  aparte bevestiging, nooit gecombineerd met V1-call.
- Geen retry-loop die meerdere betaalde calls kan triggeren; bij 4xx
  geen automatische herhaling.

## 6. Data mapping (preview → CRM)

Edge Function normaliseert response naar een stabiel DTO. Frontend
toont per veld de waarde en een "Overnemen"-knop. Bestaande, niet-lege
CRM-velden worden alleen overschreven na expliciete keuze.

**Object / Aanbod (betaald)**
- Adres, postcode, plaats → `objecten.adres/postcode/plaats`
- BAG nummeraanduiding ID → nieuw veld in DTO (opslag later, V1 alleen tonen)
- Kadastrale aanduiding, perceelgegevens → preview only (V1)
- Objecttype/gebruiksdoel → suggestie voor `type_vastgoed`
- Bouwjaar (indien geleverd) → `objecten.bouwjaar`
- WOZ-waarde + peildatum (indien beschikbaar) → preview
- Koopsom + transactiedatum → preview (V1 niet automatisch naar
  financiële velden)

**Object / Aanbod (gratis)**
- Gemeentelijke lasten (OZB, reiniging, riool) → "Kadaster &
  gebiedsdata"-kaart op Objectdetail
- Buurtstatistieken → zelfde kaart, gepresenteerd als
  - "Buurtprofiel" voor residentieel/transformatie/mixed-use
  - "Gebiedscontext" voor commercieel/BOG

**Off-market Signaal**
- Zelfde DTO; gratis gebiedsdata wordt gebruikt als gebiedscontext op
  signaal-detail. Betaalde producten alleen op expliciete klik en
  bevestiging.

**Altijd zichtbaar in preview**
- Bron: "Kadaster Objectinformatie API"
- Opgehaald op: datum/tijd
- Gebruikte productcodes
- Geschatte kosten van deze call

## 7. UX-flow

1. Gebruiker opent Objectdetail of Off-market Signaal-detail.
2. Klik op "Kadastergegevens ophalen".
3. App bepaalt zoekadres:
   - BAG-ID indien bekend (geavanceerd).
   - Anders postcode + huisnummer (+ optioneel letter/toevoeging).
   - Bij meerdere huisnummers: keuzedialog vóór de call.
   - Presentatieadres wordt nooit blind doorgestuurd.
4. Kostenconfirmatie (alleen betaalde producten).
5. Edge Function-call.
6. Preview-dialog met velden + "Overnemen"-knoppen.
7. Gebruiker kiest welke velden naar CRM gaan; rest wordt verworpen.
8. Toast met aantal overgenomen velden + bronvermelding.

Gratis "Gebiedsdata ophalen" volgt zelfde flow zonder stap 4.

## 8. V1 / V2 / V3 roadmap

- **V1** — `object` + `waarde` preview + handmatige overname; gratis
  gemeentelijke lasten + buurtstatistieken op Object en Off-market
  Signaal; postcode/huisnummer als primaire input.
- **V2** — `rechten`/eigendomsinformatie als aparte knop met eigen
  bevestiging; minimale beheerkaart met API-key status en
  verloop-reminder; BAG-ID via BAG/PDOK adresvalidatie als
  voorkeursinput.
- **V3** — PDF/documentopslag (`includePdf`), Kadasterkaart,
  Woningrapport, Product API-integratie, bulk-enrichment met aparte
  expliciete toestemming en budgetplafond.

## 9. Risico's

- **Kosten** — onbedoelde dubbele calls, verkeerd adres, bulk per
  ongeluk. Mitigatie: expliciete klik, kostenconfirmatie met adres in
  beeld, dubbele-klik preventie, geen retry-loops.
- **Key-verloop** — max 3 maanden geldig. Mitigatie: duidelijke 401/406
  meldingen, later beheerkaart + reminder.
- **Privacy** — eigendomsdata (V2) is gevoelig. Mitigatie: aparte flow,
  beperkte rol-toegang, geen automatische opslag in publieke velden.
- **Onbedoelde overschrijving** — Mitigatie: nooit auto-merge, preview +
  per-veld overnemen.
- **Foutafhandeling** — alle Kadaster-foutcodes naar NL meldingen.
- **Meerdere huisnummers** — keuzedialog vóór call.
- **Lek van API-key** — alleen Edge Function, geen log van key, geen
  vermelding in plan.md/README.

## 10. Open beslissingen (vóór Build)

1. Gratis producten — samen in één knop of apart van betaalde call?
2. Caching van gratis gebiedsdata per postcode-6/buurtcode of altijd
   verse call?
3. Default `deliver`-waarde voor V1 — `withoutProduct` bevestigen of
   `partialProduct` accepteren?
4. Einddatum API-key — V1 alleen handmatig in Secret, of minimale
   `kadaster_api_status` opslag voorbereiden (schemawijziging later)?
5. Mapping objecttype/gebruiksdoel → `type_vastgoed` — gestandaardiseerde
   suggesties of altijd handmatig?
6. Off-market Signaal — in V1 alleen gratis gebiedsdata; betaalde call
   pas na promotie naar Object?

## 11. Acceptatiecriteria deze planronde

- Geen code-, schema- of datawijzigingen.
- API-key alleen in Supabase Secret, nooit in frontend/code/logs/plan.md.
- Key max 3 maanden geldig + foutafhandeling 401/406.
- Kostenbevestiging vóór elke betaalde call.
- Nooit automatische calls bij load/save/adreswijziging.
- Preview vóór overnemen, nooit auto-overschrijven.
- V1 (object + waarde + gratis gebiedsdata) onderscheiden van V2
  (rechten/eigendom) en V3 (PDF/kaart/Product API).
- Gratis producten in Objecten én Off-market Radar.
- Postcode/huisnummer primair; BAG-ID optioneel; presentatieadres nooit
  blind; bij meerdere huisnummers eerst kiezen.

---

## Fase 4K.2 — Frontend in Objecten/Aanbod

### Status
Uitgevoerd. Off Market Radar is bewust nog niet aangeraakt (4K.3).

### Nieuwe bestanden
- `src/lib/kadaster/types.ts` — frontend-mirror van edge function types,
  helpers `KADASTER_KOSTEN_PER_MODUS` en `KADASTER_LABELS_PER_PRODUCT`.
- `src/lib/kadaster/adres.ts` — `parseObjectAdres()` haalt postcode +
  huisnummer(s) (incl. `t/m`-ranges op letters of nummers, max 10) uit
  het vrije `objecten.adres` veld; `normaliseerPostcode()` voor "1234 AB".
- `src/hooks/useKadasterObjectinformatie.tsx` — React Query mutation
  rond `supabase.functions.invoke('kadaster-objectinformatie')` met
  `retry: false` en `KadasterApiError` die `code`/`http_status` doorgeeft.
- `src/components/object/kadaster/KadasterGebiedsdataKaart.tsx` — hoofd-UI:
  - Zoekadres-blok: postcode-input + dropdown bij meerdere huisnummers +
    handmatige inputs als parsing niet betrouwbaar is.
  - Twee knoppen: "Gebiedsdata ophalen (gratis)" en "Kadastergegevens
    ophalen (€ 0,20)".
  - Kostenconfirmatie-dialog (alleen betaalde call) toont zoekadres +
    kostenopbouw vóór de call.
  - Knoppen disabled tijdens `mutation.isPending` — geen dubbele calls.
- `src/components/object/kadaster/KadasterPreviewDialog.tsx` — preview
  per product: bouwjaar, WOZ-waarde, peildatum, koopsom,
  transactiedatum, gebruiksdoel (suggestie). Optionele
  `onOvernemenBouwjaar`/`onOvernemenWozWaarde` callbacks (in V1 niet
  bedraad — alleen weergave). Technische details inklapbaar.
- `src/test/kadaster/adres.test.ts` — 13 tests voor adresparser
  (postcode normalisatie, losse huisnummers, letters, `t/m`-ranges,
  betrouwbaarheid).

### Integratie ObjectDetailPage
- Nieuwe `SectionAnchor id="kadaster-data"` op tab "meer", direct na
  Juridisch & kadastraal. Bevat `<KadasterGebiedsdataKaart>` met object-id,
  adres, postcode, plaats en `type` voor gebiedsvariant.
- `type === 'wonen' | 'mixed_use' | 'ontwikkellocatie' | 'zorgvastgoed'`
  → "Buurtprofiel"; rest → "Gebiedscontext".

### Garanties
- Geen automatische Kadaster-calls. Geen call bij render, opslaan of
  adreswijziging — alleen na expliciete klik (en bevestiging bij
  betaalde call).
- API-key blijft uitsluitend server-side; frontend kent alleen de
  Edge Function-naam.
- Objectdata wordt nooit automatisch overschreven; preview is
  read-only in V1.
- Bij meerdere huisnummers eerst keuze; presentatieadres nooit blind.
- Foutmeldingen 401/406, 412, 404, 409/422, 5xx komen vanuit Edge
  Function al in NL terug en worden via `toast.error` getoond.

### Tests
- 475/475 groen (was 462; +13 nieuwe adres-tests).

### Niet in deze stap
- Off Market Radar (4K.3).
- Product `rechten`/eigendomsinformatie (V2).
- Overname-automatiek: knoppen in preview zijn nu alleen weergave;
  bedraden naar object-update volgt eventueel in 4K.4.
- Caching, beheerkaart, schema/migratie.

## 4K.2 status — Objecten/Aanbod Kadaster-preview (actueel)

### Wat technisch werkt
- Edge Function `kadaster-objectinformatie` praat met de juiste Kadata-host
  (`kadatawebservice.kadaster.nl/objectinformatieapi/api/v1`) via header
  `X-API-KEY`.
- API-key staat uitsluitend als Supabase Secret
  `KADASTER_OBJECTINFORMATIE_API_KEY`. Niet in frontend, niet in code,
  niet in logs, niet in dit plan.
- Postcode-normalisatie: `3273 AV` → `3273AV` (uppercase, geen spaties).
  Validatie `^\d{4}[A-Z]{2}$` voordat upstream wordt aangeroepen.
- Productselectie wordt gefilterd tegen `/products` (live, met fallback
  `['object', 'waarde']`). Onbekende codes worden nooit meegestuurd, dus
  geen 409 "Een of meer onbekende producten opgegeven" meer.
- Minimaal één betaald product is verplicht — anders 400 vóór upstream.
- Standalone gratis gebiedsdata-knop is verwijderd; gratis producten
  zijn via deze API-flow niet zelfstandig bestelbaar gebleken.
- Kostenlabel in UI = "prijs volgens Kadaster" (niet hardcoded).
- Preview maakt onderscheid tussen technische fout en "product niet
  geleverd voor dit adres" — incl. veilige `response_shape` debug
  zonder secrets.

### Bruikbare producten op dit moment
- `object` (WOZ-object): preview toont BAG-velden (objectstatus,
  bouwjaar, BAG-oppervlakte, vergund gebruik, complexrelatie),
  WOZ-objectregels (nummer, gebruiksklasse, feitelijk gebruik,
  oppervlaktes, inhoud, bouwlaag) en algemene metadata
  (actualiteit, doelbinding, titel).
- `waarde` (Koopsom): kan per adres "Niet geleverd voor dit adres"
  tonen. Dit is geen technische fout — Kadaster levert eenvoudigweg
  geen transactie voor het opgevraagde object.
- `lasten` / `buurt` (gemeentelijke lasten, buurtstatistieken):
  voorlopig **niet** los beschikbaar via deze API-flow. Daarom wordt
  Off Market Radar niet direct op losse gratis gebiedsdata gebouwd.
- `rechten` / eigendomsinformatie: **blijft V2**.
- Product API / Woningrapport / kaartlagen: **blijven V3**.

### Garanties (blijven gelden)
- Geen automatische Kadaster-calls — alleen na expliciete klik én
  kostenconfirmatie bij betaalde calls.
- API-key nooit zichtbaar in frontend, code, logs of plan.md.
- Key-verloop max 3 maanden; daarna roteren via Supabase Secret.
- Objectdata wordt nooit automatisch overschreven; preview is V1
  read-only.

### Open punten voor later
1. Ander adres testen waarbij `waarde`/Koopsom wél geleverd wordt,
   om de mapping op echte transactiedata te valideren.
2. Bij Kadaster nagaan welke productcodes corresponderen met
   gemeentelijke lasten en buurtstatistieken als die via API
   beschikbaar zijn voor deze key.
3. Overnameknoppen bouwen voor veilige velden (bouwjaar,
   BAG-oppervlakte, gebruiksdoel) — handmatig, met bevestiging.
4. `rechten`/eigendomsinformatie als aparte betaalde V2-flow
   (aparte kostenconfirmatie + UI-scheiding).
5. Beheerkaart voor API-key status (laatste call, foutpercentage,
   verloopdatum-herinnering) — zonder de key zelf te tonen.
6. Optionele BAG/PDOK-adreslookup zodat zoeken zonder postcode kan
   (straat + huisnummer + plaats → postcode).
7. Off Market Radar pas later aansluiten — waarschijnlijk alleen
   na promotie naar Object, of via een aparte gebiedsdatabron.

## 4K.3 status — Handmatige overname Kadaster → Object (actueel)

### Wat werkt
- Preview-dialog heeft per veld een overname-actie. Standaard "Overnemen";
  als CRM al een waarde heeft "Vervang huidige waarde" met expliciete
  AlertDialog-bevestiging.
- Toast na succesvolle overname: "Kadastergegevens overgenomen."
- Bronvermelding "Kadaster Objectinformatie API" zichtbaar in dialog en
  bevestigingsmelding.
- Persist via `store.updateObject(id, patch)` — geen schemawijziging.

### Handmatig overneembare velden (bestaande CRM-doelvelden)
- `bagObjectData.bouwjaar` → `objecten.bouwjaar`
- `bagObjectData.oppervlakteBag` → `objecten.oppervlakte`
- `wozObjecten[0].oppervlakteWoz` → `objecten.oppervlakte`
  (alternatief; alleen als afwijkend van BAG)

### Alleen preview (geen passend CRM-veld)
- `wozObjecten[*].wozObjectNummer`
- `bagObjectData.omschrijvingVergundeGebruik`
- `wozObjecten[*].feitelijkGebruik` / `gebruiksklasse` / `monumentaanduiding`
- `wozObjecten[*].inhoud` / `bouwlaag` / WOZ-deeloppervlaktes
- `bagObjectData.objectStatus` / `complexrelatie` / `oppervlakteWijziging`
- Koopsom: `koopsom`, `koopJaar`, `koopsomValuta`, `meerOnroerendGoed`,
  `doelbinding` — bewust **niet** opgeslagen in `vraagprijs`,
  `marktwaarde`, `taxatiewaarde` of `bieding`.

### Garanties
- Geen automatische opslag of overschrijving.
- Geen extra Kadaster-calls bij overname.
- API-key blijft uitsluitend Supabase Secret.
- WOZ-objectinformatie wordt nooit als WOZ-waarde (`woz_waarde`)
  opgeslagen — die kolom blijft leeg tenzij Kadaster expliciet een
  WOZ-bedrag levert (komt momenteel niet voor in deze flow).
- Bij meerdere `wozObjecten` toont V1 alleen de eerste; overige
  zichtbaar in collapsible. Geen blinde overname over alle objecten.

### Open punten (schema-uitbreiding, niet in deze fase)
1. Velden voor Kadaster-koopsom (`kadaster_koopsom`) en koopjaar
   (`kadaster_koopjaar`) toevoegen aan `objecten`, met aparte
   bronregistratie zodat dit niet met marktwaarde/vraagprijs verward
   wordt.
2. Veld voor WOZ-objectnummer (`woz_object_nummer`).
3. Velden voor vergund gebruik (BAG), feitelijk gebruik (WOZ),
   monumentaanduiding, inhoud (m³).
4. Kadaster-metadata-veld op object (laatste aanvraagdatum,
   actualiteit, doelbinding) als compact JSON-veld — uitsluitend voor
   audit, geen mapping op bestaande tekstvelden.


## Fase 4K.4 — Nuance: gratis meegeleverde producten (`lasten`, `buurt`)

### Achtergrond
Eerder leek het dat Gemeentelijke lasten en Buurtstatistieken niet bruikbaar
zijn, omdat Kadata Internet meldde dat een bestelling minimaal één betaald
product moet bevatten ("Een of meer onbekende producten opgegeven: lasten,
buurt" bij standalone aanvraag). Nieuwe nuance: deze producten zijn mogelijk
wél leverbaar als **meegeleverde** producten binnen een aanvraag met minimaal
één betaald product (bv. WOZ-object + lasten + buurt).

### Regels
- **Geen standalone aanvraag** van `lasten` of `buurt`. Standalone blijft
  uitgeschakeld in UI en edge function.
- **Mogen later wel meegestuurd worden** binnen een aanvraag met minimaal
  één betaald product (`object` of `waarde`).
- **Alleen activeren als `/products` ze daadwerkelijk teruggeeft** voor de
  actieve API-key. Geen hardcoded productcodes `lasten` / `buurt` zolang de
  live `/products`-lijst ze niet bevestigt. De bestaande `FALLBACK_ALLOWED`
  (`['object','waarde']`) blijft hierin leidend bij ontbrekende `/products`-
  respons.
- **Geen automatische selectie**: ook als `/products` ze bevestigt, worden
  ze niet stilzwijgend meegestuurd. De UI biedt ze als opt-in checkbox bij
  een al gekozen betaald product.
- **Kostenconfirmatie blijft** vereist voor het betaalde hoofdproduct;
  meegeleverde gratis producten worden in dezelfde confirmatie genoemd
  ("inclusief lasten en buurt, indien beschikbaar").

### Per domein

**Objecten/Aanbod (4K.4B/C):**
- Bij WOZ-object of Koopsom kunnen `lasten` en `buurt` optioneel meegestuurd
  worden, mits `/products` ze beschikbaar maakt.
- Resultaat verschijnt als extra blok in de Kadasterkaart ("Gemeentelijke
  lasten", "Buurtstatistieken"), met dezelfde "Niet geleverd"-afhandeling
  als bestaande producten.

**Off Market Radar (4K.4D):**
- In signaalfase mogen `lasten` en `buurt` later eventueel meegestuurd
  worden bij `object` (WOZ-object) — uitsluitend als `/products` ze
  bevestigt en de gebruiker ze expliciet aanvinkt.
- `waarde` (Koopsom) blijft in Off Market Radar uitgeschakeld tot na
  promotie naar Object. Daarmee blijven betaalde signaal-aanvragen
  beperkt tot het goedkopere `object`.

### Security/kosten (onveranderd)
- API-key uitsluitend Supabase Secret; niet in code, frontend, logs of plan.
- Geen automatische calls; geen kostenverhogende retries.
- Foutmeldingen NL; technische details zonder secrets.
