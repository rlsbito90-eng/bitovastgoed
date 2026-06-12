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

## Fase 4K.3R — Experimentele rechten/eigendomsinformatie-preview

### Doel
Productcode `rechten` (eigendomsinformatie) handmatig kunnen testen vanuit
Objecten/Aanbod, zonder opslag, zonder relatiekoppeling, zonder integratie
in Off Market Radar of het 4K.4-datamodel.

### Wat is gebouwd
- **Edge function** `kadaster-objectinformatie` ondersteunt een lichtgewicht
  `action: 'list_products'` payload. Antwoord bevat `{products, source}` op
  basis van Kadaster's `/products` endpoint (gratis metadata, geen kosten).
- **`useKadasterProductCatalogus`** React Query hook (5 min staleTime). Wordt
  uitsluitend geactiveerd als de kostenconfirmatie-dialog opent — geen call
  bij mount.
- **`KadasterGebiedsdataKaart`** toont een extra checkbox
  "Rechten / eigendomsinformatie" in de kostenconfirmatie, **alleen** als
  `/products` deze code teruggeeft. Naam + prijs komen uit `/products`.
- **Aparte privacy-bevestiging** via `AlertDialog`. Zonder die expliciete
  bevestiging gaat de rechten-aanvraag niet door, ook al heeft de gebruiker
  de kostenconfirmatie al doorlopen.
- **Deliver-mode per product**: `rechten` → `OnlyComplete` (Kadaster vereist
  volledige rapportage voor rechten); overige producten houden
  `WithoutProduct`.
- **`KadasterPreviewDialog`** rendert een nieuwe rechten-card via
  `mapRechten()`: naam, bedrijfsnaam, type, aandeel, rechtsoort,
  kadastrale aanduiding, appartementsrecht. Labels expliciet
  "Rechthebbende(n) volgens Kadaster" — niet "verkoper".
- **`src/lib/kadaster/rechten.ts`** defensieve mapper: probeert meerdere
  shape-varianten (`rechthebbenden`, `tenaamstellingen`, `gerechtigden`,
  `eigenaren`, `rechten`, `rightHolders`) en pakt veilig de velden;
  crasht niet op onbekende structuren.

### Wat NIET (bewust)
- Geen opslag in database; geen kolommen op `objecten`/`relaties`.
- Geen automatische aanmaak/koppeling van Relaties of `eigenaar_relatie_id`.
- Geen Off Market Radar-integratie in deze fase.
- Geen meenemen in PDF/IM/export.
- Geen onderdeel van het 4K.4 datamodel (`kadaster_data_records`).
- Geen retries op rechten-aanvragen.

### Garanties
- API-key blijft uitsluitend Supabase Secret; nooit zichtbaar in
  frontend, code, logs of dit plan.
- `rechten`-checkbox verschijnt alleen na bevestiging via `/products`.
- Hardcoded productcode `rechten` wordt nooit naar `/report` gestuurd
  zonder live `/products`-bevestiging (server-side filtering blijft actief).
- Privacy-bevestiging is verplicht en niet te omzeilen door eerder
  geselecteerde producten.

### Open vervolgpunten
1. Beslissen of rechten later in een **aparte tabel** (bv.
   `kadaster_rechten_records`) wordt opgeslagen, met strenger
   beveiligingsniveau dan andere Kadaster-records (apart RLS-beleid,
   bewaartermijn, audit-log).
2. Beslissen of rechten ooit een **suggestie** mogen geven voor een
   bestaande Relatie (handmatige bevestiging vereist; geen auto-koppel).
3. Beslissen of rechten in **Off Market Radar** beschikbaar komt (in V1
   bewust niet — koopsom blijft ook daar pas na promotie naar Object).

---

## Fase 4K.4A/B — Directe persist van Kadasterrecords (uitgevoerd)

### Wat is gebouwd
- **Migration** `public.kadaster_data_records` met whitelisted velden voor
  koopsom, BAG, WOZ-object, rechten-samenvatting en `raw_limited` jsonb.
  Constraint `object_id IS NOT NULL OR signaal_id IS NOT NULL` (geen XOR
  — na promotie mogen beide gevuld zijn). RLS beperkt select/insert/update
  tot interne gebruikers; service_role behoudt toegang voor edge functions.
- **Edge function** accepteert `persist: true` en schrijft per product één
  record direct na een succesvolle Kadaster-response. Producten met status
  `niet_geleverd` worden ook opgeslagen zodat zichtbaar blijft dat het
  product voor dit adres is geprobeerd. Geen extra Kadaster-call, geen
  retry, geen API-key/headers/raw response in DB.
- **Frontend `KadasterGebiedsdataKaart`** stuurt `persist: true` mee bij
  elke Objecten/Aanbod-aanvraag. Bij succes: toast "Kadastergegevens
  opgeslagen bij dit object." Bij persist-fout met geslaagde Kadaster-call:
  duidelijke waarschuwing, geen automatische tweede aanvraag.
- **Nieuwe kaart `KadasterOpgeslagenKaart`** op Objectdetail toont laatst
  opgeslagen record per `product_code` met expliciete semantiek: WOZ-object
  als "WOZ-objectgegevens", koopsom als "Kadaster-koopsom", rechten als
  "Rechthebbende volgens Kadaster". Lege staat duidelijk in NL.

### Wat NIET (bewust)
- Geen promotie-overdracht Signaal → Object (komt in 4K.4E).
- Geen automatische overname naar objectvelden of relaties.
- Geen volledige raw response of API-key in DB.
- Geen automatische retries bij persist-fout.

---

## Fase 4K.4D — Kadasterkaart in Off Market Radar (uitgevoerd)

### Doel
Vanuit een Off Market Signaal handmatig Kadastergegevens opvragen en direct
opslaan in `kadaster_data_records` met `signaal_id`, zodat eigenaars- en
acquisitie-onderzoek niet verloren gaat.

### Scope V1 voor Off Market Radar
- **Toegestane producten:** `rechten` (Rechten/eigendomsinformatie) en
  `waarde` (Koopsom).
- **Bewust niet aangeboden:** `object` (WOZ-object). WOZ-objectkenmerken
  zijn voor Objecten/Aanbod nuttig; in de signaalfase richten we ons op
  eigenaar/rechthebbende en historische koopsom.
- Productlijst wordt gefilterd op zowel `SIGNAAL_ALLOWED_PRODUCTS` als
  Kadaster's `/products`-endpoint. `lasten`/`buurt` worden niet aangeboden.

### Implementatie
- Nieuwe component `SignaalKadasterKaart` (off-market/kadaster/) op
  `OffMarketSignaalDetailPage`, geplaatst onder Eigenaarsonderzoek.
- Statusregel toont: laatst opgehaald, zoekadres, productcodes, bron.
- Lege staat: "Nog geen Kadastergegevens opgehaald voor dit signaal."
- Knop: "Kadastergegevens ophalen" → kostenconfirmatie met productselectie.
- Bij `rechten` altijd een tweede, expliciete privacy-/kostenbevestiging.
- Bij `waarde` disclaimer: "Kadaster-koopsom is geen marktwaarde,
  vraagprijs of taxatiewaarde."
- Zoekadres hergebruikt `parseObjectAdres`; postcode wordt strikt
  genormaliseerd (`3273AV`). Geen vrije adresregel naar Kadaster.
- Aanvraag stuurt `context.signaal_id` + `persist: true`. Edge function
  schrijft per product een rij in `kadaster_data_records` met `signaal_id`
  (ook voor `niet_geleverd` producten).
- Hook `useKadasterDataRecordsForSignaal` leest records read-only en
  toont laatste record per `product_code`. Labels strikt:
  "Kadaster-koopsom" en "Rechthebbende volgens Kadaster".

### Wat NIET (bewust)
- Geen WOZ-object/product `object` in Off Market Radar V1.
- Geen automatische Kadaster-call (niet bij openen, statuswijziging,
  AI-run of promotie).
- Geen relatie/eigenaar/verkoper automatisch aanmaken of koppelen.
- Geen automatische AI-herberekening of score-update.
- Geen bulkverrijking in deze fase.
- Geen schemawijzigingen (bestaande tabel volstaat).

### Toekomst — bulkverrijking (alleen backlog, niet bouwen)
- Mag nooit automatisch op alle signalen draaien; alleen handmatig
  geselecteerde signalen.
- Vooraf kosteninschatting + productselectie tonen.
- Producten: `rechten` en `waarde`; mogelijk later andere na expliciete
  keuze. Voor `rechten` altijd extra privacy-/kostenbevestiging.
- Maximum batchgrootte verplicht; geen automatische retries op betaalde
  calls.
- Resultaten per signaal direct in `kadaster_data_records`; fouten per
  signaal apart tonen.
- Mag geen relaties, eigenaren, verkopers of AI-scores automatisch
  aanpassen.

### Vervolgstappen
1. **4K.4E — Promotie Signaal → Object**: bij promotie de bestaande
   Kadasterrecords doorzetten naar het nieuwe object (beide IDs gevuld;
   geen nieuwe Kadaster-call).
2. Handmatige actie "Relatie maken/koppelen van rechthebbende" als
   expliciete vervolgstap.
3. Handmatige knop "AI opnieuw verrijken met Kadasterdata".
4. Bulkverrijking voor geselecteerde signalen (zie backlog hierboven).
5. **API-key statuskaart** in admin voor key-rotatie en `/products` check.
6. **PDF-opslag** als latere optionele kolom (alleen na expliciete keuze).

## Fase 4K.4E — Kadasterrecords meenemen bij promotie Signaal → Object (uitgevoerd)

### Doel
Bij promotie van een Off Market Signaal naar Object/Aanbod kunnen reeds
opgehaalde Kadasterrecords worden meegenomen naar het nieuwe object,
zonder een nieuwe (betaalde) Kadasteraanvraag.

### Implementatie
- `usePromoteSignaalToObject` accepteert nu `{ signaalId, migrateKadaster }`
  en retourneert `{ objectId, kadasterMigrated, kadasterMigrationError }`.
- Na succesvolle RPC `off_market_promote_to_object` worden bestaande rijen
  in `kadaster_data_records` met `signaal_id = X` en `object_id IS NULL`
  bijgewerkt met `object_id = nieuw object`. `signaal_id` blijft staan,
  zodat de audit-relatie met het oorspronkelijke signaal behouden blijft.
- Bestaande tabel volstaat — geen schemawijzigingen, geen migraties.
- `SignaalKoppelingenSectie` toont een AlertDialog-bevestiging bij
  "Omzetten naar object". Wanneer het signaal Kadasterrecords heeft,
  verschijnt een checkbox "Kadasterdata meenemen naar object" (default
  aan) met subtekst dat objectvelden, relaties en eigenaren niet
  automatisch worden overschreven. Zonder records: geen checkbox.
- Toasts: succes-melding bij promotie + aparte "Kadasterdata meegenomen
  naar object" bij gelukte koppeling. Bij koppelfout een waarschuwing:
  "Object is aangemaakt, maar Kadasterdata kon niet automatisch worden
  gekoppeld. De data staat nog bij het oorspronkelijke signaal." Geen
  rollback, geen retry-loop, geen nieuwe Kadaster-call.
- Objectdetail toont via bestaande `KadasterOpgeslagenKaart` de
  meegenomen records (Kadaster-koopsom, Rechthebbende volgens Kadaster).

### Wat NIET (bewust)
- Geen nieuwe Kadaster Edge Function-call tijdens promotie.
- Geen objectvelden automatisch ingevuld (marktwaarde, vraagprijs,
  taxatiewaarde, koopsom-veld).
- Geen relatie/eigenaar/verkoper automatisch aangemaakt of gekoppeld.
- Geen `eigenaar_relatie_id` automatisch ingevuld vanuit rechthebbende.
- Geen automatische taak of contactmoment aangemaakt.
- Geen automatische AI-herberekening of score-update.
- Geen records gedupliceerd; records blijven aan signaal én object hangen.

### Tests
- `src/test/offMarket/kadaster/promoteMigratie.test.ts`:
  geen kadaster-update bij `migrateKadaster=false`; juiste update bij
  `migrateKadaster=true`; fout bij koppeling blokkeert object niet; geen
  extra Kadaster-RPC tijdens promotie.

### Vervolgstappen (backlog)
1. Handmatige actie "Relatie maken/koppelen van rechthebbende".
2. Handmatige knop "AI opnieuw verrijken met Kadasterdata".
3. Bulkverrijking voor geselecteerde signalen (zie eerdere backlog).
4. API-key statuskaart in admin (key-rotatie en `/products` check).
5. PDF-opslag als latere optionele kolom (alleen na expliciete keuze).

## Fase 4K.4C — BAG/PDOK adreslookup voor Kadaster (uitgevoerd)

### Doel
Gebruiker kan in Objecten/Aanbod en Off Market Radar via straat +
huisnummer (+ plaats) een officieel BAG-adres opzoeken, zodat postcode +
huisnummer voor de Kadasteraanvraag worden ingevuld zonder handmatig
postcodes op te zoeken.

### Implementatie
- Nieuwe helper `src/lib/bag/pdokLookup.ts` — gebruikt publieke PDOK
  Locatieserver (`api.pdok.nl/.../search/v3_1/free`, `fq=type:adres`).
  Geen API-key. Geen Kadaster-call. Genormaliseerde velden:
  straat, huisnummer, huisletter, huisnummertoevoeging, postcode
  (zonder spatie), woonplaats, `nummeraanduiding_id`,
  `adresseerbaar_object_id`.
- Nieuwe component `src/components/shared/BagAdresLookup.tsx` — herbruikbaar
  formuliertje met "Adres zoeken"-knop (handmatige actie), max 10
  resultaten, geen automatische keuze, foutmelding bij 0 resultaten.
- Geïntegreerd in:
  - `KadasterGebiedsdataKaart` (tab "Adres") — vult postcode +
    huisnummer + letter + toevoeging + straat/plaats voor object.
  - `SignaalKadasterKaart` — vult postcode + handmatig huisnummer +
    letter + toevoeging voor signaal.
- Kadasterknop blijft pas actief bij geldige postcode (4 cijfers + 2
  letters) en huisnummer. "Aanvraag gebruikt: …" toont het effectieve
  zoekadres ongewijzigd.

### Wat NIET (bewust)
- Geen Kadaster-call tijdens of na BAG-lookup.
- Geen automatische keuze van eerste resultaat.
- Geen BAG-ID rechtstreeks naar Kadaster (PHT blijft postcode +
  huisnummer); BAG-ID alleen in UI/resultaatdetails getoond.
- Geen opslag van BAG-resultaten als losse tabel; alleen via bestaand
  object-/signaal-save.
- Geen schemawijzigingen, geen datamigraties, geen nieuwe secrets.

### Tests
- `src/test/bag/pdokLookup.test.ts`: postcodenormalisatie, query-bouw,
  PDOK fetch + mapping, geen call bij lege query.

### Backlog
1. BAG-ID rechtstreeks gebruiken in Kadasterrequest als bestaande
   Edge Function dit veilig ondersteunt.
2. App-brede adreslookup bij object/signaal-invoer (niet alleen
   Kadasterkaart).

## Fase 4K.4F — Rechten-mapping aangescherpt + Kadaster-historie

### Waarom
Rechten-records werden geleverd met status "geleverd" maar UI toonde
lege velden. Daarnaast konden meerdere aanvragen op verschillende
zoekadressen (bv. 9-H en 9-1) niet als historie worden teruggezien —
alleen de laatste record per productcode was zichtbaar.

### Implementatie
- Edge Function `kadaster-objectinformatie/_persist.ts` — rechten-branch
  veel breder: zoekt rechthebbenden in extra arrays (`personen`,
  `rechtspersonen`, `natuurlijkePersonen`, `nietNatuurlijkePersonen`),
  pakt naam/bedrijfsnaam/type/rechtsoort/aandeel uit aanvullende
  veldnamen, slaat in `raw_limited.rechten` een diagnostische shape op
  (top-level keys, arrays met lengte + eerste-item keys, gebruikte
  array). Geen volledige raw response, geen secrets.
- `src/lib/kadaster/rechten.ts` — `mapRechten` uitgebreid met dezelfde
  alternatieve veldnamen (gerechtigden / naamRechthebbende /
  naamNietNatuurlijkPersoon / zakelijkRecht / breukdeel /
  gerechtigdAandeel / kadastraalObject).
- `KadasterPreviewDialog` — rechten-tekst gecorrigeerd ("Intern
  opgeslagen als Kadasterrecord. Niet automatisch gekoppeld …").
  Lege rechten-respons toont nu duidelijke melding "Rechten geleverd,
  maar rechthebbende-velden nog niet herkend".
- Nieuwe component `src/components/object/kadaster/KadasterHistorieLijst.tsx`
  — inklapbaar blok "Eerdere Kadasteraanvragen (N)" met per record
  datum, productnaam, status, zoekadres, korte samenvatting en
  technische details (incl. `raw_limited.rechten` shape).
- `KadasterOpgeslagenKaart` en `SignaalKadasterKaart` — hoofdkaart
  blijft laatste-record-weergave; historie hangt onder als
  inklapbaar blok. Rechten-cards tonen fallback-melding bij lege
  velden.

### Wat NIET (bewust)
- Geen nieuwe Kadaster-call.
- Geen schemawijziging, geen migraties.
- Geen automatische relatie/eigenaar/verkoper-koppeling.
- Geen volledige raw response of secrets in `raw_limited`.

### Tests
- `src/test/kadaster/rechtenExtra.test.ts` — extra veldnamen voor
  rechten-mapper, fallback-gedrag, geen crash bij onbekende shape.

### Backlog
- Handmatige actie "Relatie maken/koppelen van rechthebbende" — pas
  later, met expliciete bevestiging en zonder automatische CRM-koppeling.

## Fase 4K.5 — Kadasterbericht/PDF intern opslaan (afgerond)

### Backend
- Tabel `kadaster_documenten` + `kadaster_data_records.pdf_document_id` (RLS intern only).
- Edge Function `_pdf.ts` — extract base64-PDF uit Kadaster-respons, upload
  naar `bito-objecten` bucket, insert document-rij. Geen secrets/headers in
  logs. `includePdf` doorgezet; response uitgebreid met `persist.pdf`.

### Frontend
- Checkbox "Kadasterbericht/PDF intern opslaan" in `KadasterGebiedsdataKaart`
  (Objecten/Aanbod) en `SignaalKadasterKaart` (Off Market Radar). Default uit;
  expliciete extra uitleg bij Rechten.
- `includePdf` wordt meegegeven aan `voerCallUit` op basis van checkbox.
- PDF-knop (`KadasterPdfKnop`) zichtbaar bij Objectdetail én Signaal-detail
  via `useKadasterDocumentenForObject` / `useKadasterDocumentenForSignaal` —
  signed URL via `openKadasterDocument`.
- Rechten zonder herkende JSON-velden maar mét PDF tonen melding
  "Rechten geleverd. Rechthebbendevelden niet herkend in JSON, maar
  Kadasterbericht is opgeslagen." + knop "Kadasterbericht openen".

### Promotie Signaal → Object
- `usePromoteSignaalToObject` koppelt nu ook `kadaster_documenten.object_id`
  bij `migrateKadaster=true`. `signaal_id` blijft behouden. Geen nieuwe
  Kadaster-call, geen PDF-dupes, geen nieuwe upload.

### Security
- PDF's intern only (RLS admin/medewerker, signed URL ≤5 min).
- Niet automatisch in dataroom/teaser/IM/export.
- Geen automatische parsing/OCR.
- Geen automatische relatie-/eigenaar-/verkoperkoppeling.
- Geen API-key/secrets in document-metadata of debug.

### Tests
- `src/test/kadaster/pdf.test.ts` — PDF-extractie + veilige padbouw.
- `src/test/offMarket/kadaster/promoteMigratie.test.ts` uitgebreid met
  documenten-migratie.

### Backlog
- Rechten-PDF analyseren/parsen (handmatige actie).
- Bulk-PDF aanvraag voor geselecteerde signalen.
- API-key statuskaart.

## Fase 4K.6 — Rechten als blokken + PDF altijd zichtbaar (afgerond)

### Frontend
- Nieuwe mapper `src/lib/kadaster/rechtenBlokken.ts` bouwt genormaliseerde
  `KadasterRechtenBlok[]` met rechtstype, aandeel, partij (natuurlijk
  persoon of rechtspersoon), geboortedatum/-plaats, KvK/zetel, adres,
  registerverwijzing (Hyp4 Deel/nummer) en kadastrale aanduiding.
- Defensief: meerdere per-rechttype containers (`rechten`, `overigeRechten`,
  `eigendom`, ...) én geneste `rechthebbenden`-lijsten; fallback op platte
  top-level rechthebbenden-arrays.
- `src/components/object/kadaster/KadasterRechtenBlokken.tsx` — kaart per
  blok; PDF-bronbalk wordt altijd bovenaan getoond als Kadasterbericht
  beschikbaar is, óók wanneer JSON wel velden geleverd heeft.
- Toegepast in `KadasterOpgeslagenKaart`, `SignaalKadasterKaart` en de
  rechten-tak van `KadasterPreviewDialog`.

### Backend
- `_persist.ts` slaat een whitelisted `raw_limited.rechten.blokken` op
  (max 20 blokken, diepte 3) zodat opgeslagen records meerdere blokken
  kunnen tonen — geen volledige raw, geen secrets, geen schemawijziging.

### Niet-doelen
- Geen automatische CRM-relatie-aanmaak/-koppeling.
- Geen automatische eigenaar/verkoper-invulling, geen objectveld-overname.
- Geen automatische AI-aanpassing, geen nieuwe Kadaster-call.

### Tests
- `src/test/kadaster/rechtenBlokken.test.ts` — meerdere blokken
  (eigendom + erfpacht) met adres/KvK/zetel/registerverwijzing, platte
  fallback, lege/onbekende input, en `blokUitOpgeslagenRecord`.


## Bugfix 4K.6.1 — SignaalKadasterKaart blijft laatst opgehaalde data tonen
- `mapRechtenBlokken` herkent nu ook de Kadaster API-shape met
  `persons` / `entities` per rechten-item én de persist-shape met
  `raw_limited.rechten.blokken`. Combineert lijsten i.p.v. eerste-match.
- `_persist.ts`: `lijstKeys` en `rechtenBlokKeys` uitgebreid met
  `persons`/`entities` (en `rechthebbenden`-geneste), zodat nieuwe
  aanvragen rechthebbendevelden én structurele blokken whitelist-opslaan.
- `SignaalKadasterKaart`:
  - elke `RecordKaart` toont nu altijd een kop met datum, zoekadres en
    status — record blijft zichtbaar ook zonder PDF of zonder herkende
    blokken;
  - PDF-knop optioneel, niet vereist voor recordweergave;
  - loop over `laatsteMap.entries()` i.p.v. hardcoded productlijst
    zodat geen record onbedoeld weggefilterd wordt.
- Tests: `persons`/`entities`-shape + `blokken`-persist-shape.
- Geen nieuwe Kadaster-call, geen schemawijziging, geen CRM-koppeling.


## Bugfix 4K.6.2 — Kadasterdocumenten zichtbaar in Signaal/Object
- **Root cause**: `public.kadaster_documenten` en `public.kadaster_data_records`
  hadden geen GRANTs voor `authenticated`/`service_role`. Data API gaf
  daardoor permission denied → records/PDF's leken "verdwenen" in UI.
  Migration voegt benodigde GRANTs toe (geen RLS-wijziging).
- `KadasterPdfKnop`: signed URL wordt altijd vers opgevraagd bij klik
  (geen state-cache). Foutmelding nu:
  "Kadasterbericht bestaat, maar kon tijdelijk niet worden geopend.
   Probeer opnieuw of controleer opslagrechten."
- `documentenPerRecord(docs, records?)`: fallback-matching op
  `signaal_id`/`object_id` + `product_code` + `fetched_at` (±5 min)
  voor records waar `pdf_document_id` ontbreekt. PDF-knop blijft zo
  zichtbaar bij oudere records.
- Storage bucket blijft privé; openen alléén via signed URL.
- Geen nieuwe Kadaster-call, geen automatische relatiekoppeling.


## Security-audit punt — SECURITY DEFINER linterwaarschuwingen (pre-existing)
- Bevestigd: de SECURITY DEFINER-warnings van de linter zijn **niet**
  geïntroduceerd door de Kadaster-GRANT migration
  (`20260610225657_…`). Die migration bevat uitsluitend
  `GRANT`-statements op `kadaster_documenten` en `kadaster_data_records`
  — geen `CREATE FUNCTION`, geen `SECURITY DEFINER`.
- De gemarkeerde SECURITY DEFINER-functies bestaan al sinds eerdere
  migrations (vanaf 2026-04-16), o.a.:
  `handle_new_user`, `has_role`, `is_intern_gebruiker`,
  `generate_refnummer`, `off_market_bron_stats`,
  `off_market_promote_to_object`, `update_updated_at_column`.
- Actiepunt (apart, niet nu): review of elke SECURITY DEFINER-functie
  een vaste `search_path` heeft (`SET search_path = public`) en of
  EXECUTE-rechten correct zijn ingetrokken voor `anon`/`public` waar
  niet nodig (zie eerdere migration `20260523082538_…`). Geen refactor
  in deze fase.

## 2026-06-11 — Diagnose "verdwenen" Kadaster-PDF (Sarphatipark)

**Conclusie:** geen bug, geen code-wijziging.

Onderzoek in DB toonde:
- `kadaster_documenten` + `kadaster_data_records` voor Sarphatipark 86-2 (1073EB) hangen
  correct aan signaal `811e02a2-132d-4206-9dba-92335b05af11` (titel:
  "Omzettingsvergunning Sarphatipark 86-2 1073EB Amsterdam"). FK's en
  `pdf_document_id` zijn over en weer gevuld; storage_path bestaat.
- Het signaal dat de gebruiker open had (`1a0a23a6-…dcd50`) is een
  ANDER signaal: "Splitsingsvergunning Sarphatistraat 90 1018GT Amsterdam".
  Daar is nooit een Kadasteraanvraag voor gedaan, dus de UI-melding
  "Nog geen Kadastergegevens opgehaald voor dit signaal" is correct.

Geen orphan record, geen ontbrekende GRANT, geen verloren signaal_id.
Persist-flow uit Fase 4K.5/4K.6 werkt zoals bedoeld.

## 2026-06-11 — Rechten persist & mapper: live API persons/entities

**Wijzigingen:**
- `_persist.ts`: rechtenBlokKeys uitgebreid met `voornamen`, `geslachtsnaam`,
  `toevoeging`, `documentVermeldIn`, `stukMelding`. `raw_limited.rechten.blokken`
  bevat nu per recht een whitelisted samenvatting incl. `persons`/`entities`,
  `aandeelInRecht`, `omschrijving`/`naam`, `documentGebaseerdOp`, `aanduiding`.
- `rechtenBlokken.ts`:
  - rechtstype-fallback op `naam` (Kadaster API levert vaak `naam:"Eigendom"`).
  - `leesRegisterVerwijzing` herkent `documentGebaseerdOp`, `documentVermeldIn`,
    `stukMelding` (string of `{naam, deel, nummer}` object).
  - parent registerVerwijzing / kadastraleAanduiding worden via context
    overgegeven aan elk rechthebbende-blok (persons/entities erven dit van
    het recht-item).
- Tests: live API-shape met `persons` + `entities` + `documentGebaseerdOp` +
  `aandeelInRecht`; persist-shape met alleen `naam` als rechtstype.

**Bestaande records** (zoals Sarphatipark 86-2, zonder `blokken` in
`raw_limited.rechten`) blijven afhankelijk van de opgeslagen PDF — geen
automatische backfill, geen nieuwe Kadaster-call. PDF blijft officiële bron.

**Vervolg (apart):** PDF-parser voor oudere records; handmatige
actie "Relatie maken/koppelen van rechthebbende".

## 2026-06-11 — Kaart 1: Off Market Radar kaartweergave

**Gebouwd**
- Nieuwe tab `Kaart` in `OffMarketPage.tsx` (persistent via sessionStorage).
- `OffMarketKaart` (`src/components/offmarket/kaart/`) met MapLibre GL JS +
  react-map-gl/maplibre, PDOK BRT-Achtergrondkaart tiles, default viewport
  = laatst gebruikte (sessionStorage) met fallback Nederland.
- GeoJSON-source + cluster + losse pinnen. Pin-kleur op `prioriteit`
  (urgent rood, hoog oranje, midden geel, laag grijs). Legenda rechtsonder.
- Popover bij pin met titel, adres, type, status- en prioriteit-badge,
  bron + datum en knop "Open signaal". **Geen** eigenaar/Kadaster/notities.
- Samenvouwbaar sidepanel desktop met klik-naar-pan; mobiel = full-bleed kaart.
- Filters (status, prio, asset, regio, bron, AI-status, zoek) gedeeld
  tussen Signalen- en Kaart-tab.
- Datumbuckets `Actueel | Komend | Historisch | Alles`
  (`src/lib/offMarket/kaart/datumbucket.ts`, bron_datum primair,
   volgende_actie_datum secundair).

**Automatische PDOK-geocoding** (`useKaartGeocoding`)
- Draait **alleen** bij openen Kaart-tab, niet bij Dashboard/Signalen.
- Max 3 parallel; session-cache van geprobeerde signaal-ids tegen loops.
- Veilige match: type=adres, huisnummer matcht parsed signaal-huisnummer,
  postcode OF plaats matcht, geen tweede kandidaat met vergelijkbare score.
- Auto-opslag: `lat`/`lng` direct naar `off_market_signalen`. Geen
  schemawijziging — kolommen bestonden al.
- Onzekere matches → "Locatie controleren"-dialog met kandidatenlijst,
  gebruiker kiest handmatig.
- Signalen zonder adres of zonder match → "Zonder locatie"-dialog met
  knop "Zoek via PDOK" voor handmatige retry.
- Geen Kadaster-call, geen AI-call, geen bulkverrijking, geen kosten.

**Tests** (23 tests, allemaal groen)
- `geocode.test.ts`: adresparser, querybouw, veilige match-beoordeling.
- `datumbucket.test.ts`: actueel/komend/historisch classificatie.
- `kaartHelpers.test.ts`: lat/lng-validatie, GeoJSON-build, kleur per prio.

**Privacy/security**
- Pin-preview en sidepanel tonen geen eigenaargegevens, telefoons,
  e-mails, notities, Kadasterrechten of dealwaarden.
- Kadasterdata blijft uitsluitend in signaaldetail (RLS-beschermd).

**Toekomstige fasen** (in plan, niet gebouwd)
- **Kaart 2**: schema-uitbreiding `geocode_kwaliteit`/`geocode_bron`/
  `geocode_op`/`bag_nummeraanduiding_id`, viewport-gekoppelde lijst,
  drag-to-correct pin, bulk-geocode achter admin-flag.
- **Kaart 3 — Kopers-/zoekprofiel-overlay**: locatie-intentie met
  zekerheidsniveau (Exact gebied / Stad / Regio / Breed / Onbekend).
  Vage zoekprofielen ("Rotterdam", "Randstad", "Nederland bij goede deal")
  worden expliciet **geen** harde matches; alleen geaggregeerd op kaart
  zichtbaar. Geen persoonsgegevens van kopers op de kaart. Polygon-laag,
  heatmap en kandidaatmatchtelling zijn opties voor deze fase.
- Niet-blokkerend voor Kaart 1: MapLibre ondersteunt meerdere lagen
  (signalen, toekomstige vraag-/heatmaplaag) zonder herontwerp.

## Kaart 1.1 — PDOK auto-geocoding aangescherpt (afgerond)
- `parseAdres` normaliseert huisletter + toevoeging tot één uppercase string
  (`405A`, `405 A`, `405-A` → `A`; `12-2`, `12 2` → `2`).
- `GeocodeKandidaat` slaat nu `huisletter` + `huisnummertoevoeging` uit PDOK
  op als genormaliseerde `toevoeging`.
- `beoordeelKandidaten` kiest automatisch wanneer er na huisnummer + postcode/
  plaats-filter exact één kandidaat is met dezelfde toevoeging als het signaal.
  Exacte toevoeging-match wint van hogere PDOK-score met verkeerde toevoeging.
- Input zonder toevoeging blijft `controleren` zodra PDOK meerdere
  toevoegingen levert.
- `GeocodeResultaat` heeft een `redenCode` (`exact_addition_match`,
  `multiple_candidates`, `addition_mismatch`, `postcode_mismatch`,
  `too_uncertain`, `no_housenumber`, `no_candidates`, `insufficient_input`)
  voor veilige debug-logging zonder persoons-/sleutel-data.
- Geen Kadaster/AI/schemawijziging. 22 geocode-tests groen.

## Kaart 1A — Slimmere PDOK + leesbare UI + mobiele dialog (afgerond)
- **Geocoding slimmer**: nieuwe regel "basisadres uniek" — input zonder
  toevoeging matcht automatisch wanneer in PDOK exact één resultaat
  zónder toevoeging voorkomt naast subadressen
  (bv. *Jan Luijkenstraat 16* met `16`, `16-1`, `16-2` → auto op `16`).
- **Straatnaam-check** met diakritieken-normalisatie (`stripDiacritics`)
  voorkomt straatmismatch-auto's.
- **Toevoegingsmatch** kiest binnen de exacte-set de hoogste score in
  plaats van direct te falen bij dubbelen.
- **Score-dominantie** (`MIN_TOP_SCORE`=8, `MIN_SCORE_GAP`=2) voor
  zeldzaam geval van meerdere basisadressen.
- Nieuwe redencodes: `basic_address_unique`, `top_score_dominant`,
  `multiple_additions`, `street_mismatch`; helper `redenLabel()` voor
  Nederlandse UI-tekst.
- **Locatie controleren-chip**: nu solide `bg-accent` met
  `accent-foreground`, duidelijk leesbaar tegen kaartachtergrond in
  light/dark. Overige chips ook op solide `bg-background` gezet.
- **Mobiele dialogen** (`LocatieControlerenDialog`, `ZonderLocatieDialog`)
  full-screen op mobiel (`w-[100vw] h-[100vh] rounded-none`), sticky
  header, scrollbare body, full-width result-cards en `min-h-[40px]`
  knoppen. Op desktop blijft de bestaande dialog (`sm:max-w-2xl
  sm:max-h-[85vh] sm:rounded-2xl`).
- **Beste-kandidaat** wordt in de controleren-lijst gemarkeerd met een
  `Beste`-badge maar nooit automatisch gekozen.
- Geen Kadaster/AI/schemawijziging. 549 tests groen.


## Kaart 1B — Toevoegingsmatch + mobiele sluitknop (afgerond)
- PDOK-kandidaat toevoeging wordt nu uit `weergavenaam` geparset (volgorde-onafhankelijk), met fallback op huisletter/huisnummertoevoeging.
- `parseAdres` accepteert nu varianten als `101-2`, `20-3L`, `20 3L`, `26A`, `4 hs`, `4 huis` (HUIS → HS).
- Signaal mét expliciete toevoeging matcht alleen automatisch op exact dezelfde toevoeging; afwijkende toevoegingen worden nooit auto-gekozen en krijgen geen "Beste"-label meer.
- "Beste"-label in Locatie controleren is vervangen door "Exacte toevoeging" (signaal mét toevoeging) of "Beste" (alleen wanneer signaal géén toevoeging heeft én er één basisadres-kandidaat is). Anders géén label.
- Mobiele Locatie controleren-dialog heeft nu een altijd zichtbare sticky sluitknop rechtsboven (44x44, z-20, safe-area-top), default Radix X verborgen om dubbele knoppen te voorkomen.
- Geen Kadaster/AI/schemawijziging. 29 geocode-tests groen.
