
# Fase 3 — Bron van waarheid & datalogica

> Deliverable: dit rapport wordt geschreven naar `.lovable/plan.md` (vervangt huidige Fase 2-inhoud, of wordt eronder gezet als appendix — keuze 8.1). **Geen code, geen schema, geen migratie in deze ronde.**

---

## 1. Samenvatting

De codebase (`mock-data.ts`, `ObjectDetailPage`, `ObjectFormDialog`, `vastgoedrekenen/*`, `objectDossier/*`, `NotificationsBell`) bevat meerdere parallelle "waarheden" voor dezelfde gegevens. Belangrijkste risico's:

1. **Financiële KPI's** (BAR/NAR/factor/huurPerM2/maandhuur) staan als opgeslagen velden op `ObjectVastgoed` (`brutoAanvangsrendement`, `nettoAanvangsrendement`, `huurPerM2`, `noi`) terwijl `lib/financialCalc.ts` en `lib/vastgoedrekenen/compute.ts` dezelfde getallen kunnen afleiden. Snapshots kunnen verouderen zodra vraagprijs/jaarhuur muteren.
2. **Taxonomie**: `type` + `subcategorie` + `subcategorieId` (legacy) leven naast `propertyTypeId` + `propertySubtypeIds` + `dealTypeIds`. Matching en zoekprofielen vallen nog terug op legacy.
3. **Pand**: `energielabel` (legacy free-text) naast `energielabelV2` (enum); idem `onderhoudsstaat` vs `onderhoudsstaatNiveau`.
4. **Verhuur**: `object.aantalHuurders`, `object.huurinkomsten`, `object.leegstandPct` versus `ObjectHuurder[]` rijen + `ObjectHuurMetrics`. Drievoudige potentieel afwijkende bron.
5. **Scenario's**: `object.financieleScenarios` (oude inline struct) bestaat naast de volwaardige Vastgoedrekenen-engine. Concurrerende biedadviesbron.
6. **Documenten**: `documentenBeschikbaar: boolean` + `documentatieStatus: Record` + `ObjectDocument[]` + `objectDossier`-checklist + Media-tab → vier bronnen voor "is doc X aanwezig".
7. **Notificaties**: drempel `STRONG_MATCH_MIN = 5` op een 0–100 score (zie `getAllMatchesFromData` → `score = Math.max(0, Math.min(100, score))`). Dit is vrijwel zeker een bug — drempel zou 70/85 moeten zijn, of de score moet naar 0–5 worden geschaald.
8. **Dealflow/lead deal/fee**: `leadDeal` wordt ad-hoc op de detailpagina afgeleid; "verwachte fee" gebruikt `commissieBedrag × FASE_KANS`. Geen centrale derivation-helper.

Conclusie: dit is primair een **derivation-en-bron probleem**, niet een schema-probleem. Fase 3 kan in 3 subfases zonder DB-wijziging.

---

## 2. Bronnen van waarheid per domein

| Domein | Leidend veld / module | Derived velden | Legacy / fallback | Risico | Aanbevolen actie |
|---|---|---|---|---|---|
| Object stamdata | `titel`, `adres/postcode/plaats/provincie`, `status`, `internNummer` op `ObjectVastgoed` | `publiekeNaam` (kan derived van regio + type) | `bron` als free-text vs. `aanbiedingswijze` enum | Laag | Houden zoals nu; geen actie |
| Taxonomie | `propertyTypeId`, `propertySubtypeIds`, `dealTypeIds` | label-strings via `usePropertyTaxonomie` | `type: AssetClass`, `subcategorie`, `subcategorieId` | Middel — matching gebruikt nog beide paden (`mock-data.ts:1028-1118`) | Fase 3B: zachte sync (bij save: legacy auto-afleiden uit nieuw), Fase 3C: legacy uit UI verwijderen |
| Pand / energie / onderhoud | `energielabelV2`, `onderhoudsstaatNiveau`, `bouwjaar`, `oppervlakte(VVO/BVO/GBO)`, `aantalVerdiepingen`, `aantalUnits` | — | `energielabel` (string), `onderhoudsstaat` (string) | Laag — V2 al primair in UI | Fase 3A: legacy alleen-lezen tonen; Fase 3C: weglaten uit form payload |
| Financieel | **Bronvelden**: `vraagprijs`, `jaarhuur` (= `huurinkomsten`), `servicekostenJaar`, `wozWaarde`, `taxatiewaarde`, `oppervlakte(GBO)`, `marktwaardeIndicatie` | `maandhuur`, `huurPerM2`, `prijsPerM2`, `bar`, `factor`; `noi`/`nar` derived **met override** | `prijsindicatie` (free-text) | Hoog — `brutoAanvangsrendement`/`nettoAanvangsrendement`/`huurPerM2`/`noi` worden nu als opgeslagen kolommen behandeld; kunnen stale zijn | Fase 3A: alles via `financialCalc.ts` derive on render, opgeslagen velden alleen als override-snapshot |
| Verhuur / huurders | `ObjectHuurder[]` rijen als aanwezig | `aantalHuurders`, `totaleJaarhuur`, `verhuurdeM2`, `WALT`, `WALB` via `ObjectHuurMetrics` | `object.aantalHuurders`, `object.huurinkomsten`, `object.leegstandPct` op objectniveau | Hoog — kan stilzwijgend afwijken | Fase 3A: derivation-helper `deriveVerhuurMetrics(object, huurders)`; toon mismatch-badge bij delta > 1% |
| Vastgoedrekenen | `scenario`-rij + `Component[]` + `ScenarioCost[]` + `WwsUnit[]` + `TaxSettings` via `computeScenario()` | `maximumBid`, `bar/factor/nar`, `noi`, `dealScore`, `conclusion` | `object.financieleScenarios` (inline huidig/marktconform/naRenovatie) | Hoog — twee biedadvies-bronnen | Fase 3A: detail-tab markeert `financieleScenarios` als legacy-snapshot, read-only; Fase 3B: importknop naar nieuw scenario; Fase 3C: veld verbergen |
| Dossier / documenten | `objectDossier`-checklist (`computeReadiness` op `CHECKLIST_CATALOG`) | `readinessLabel`, `score`, `missingCritical`, autostatus uit `objectRecord` via `autoFromObjectField` | `documentenBeschikbaar: boolean`, `documentatieStatus: Record<docType, beschikbaar/op_aanvraag/na_nda>` | Middel — drievoudige bron, maar `documentatieStatus` is IM-zichtbaarheidssignaal en hoort niet als status | Fase 3A: `documentenBeschikbaar` nooit meer prominent (alleen filter-fallback); `documentatieStatus` herbenoemen als "IM-publicatie" semantisch |
| Media | `ObjectDocument` (`documenttype`) + `ObjectFoto` (`isHoofdfoto`, `isPlattegrond`) | Sectie-rendering op detail: foto's vs plattegronden vs documenten | `documenttype = 'plattegrond'` op `ObjectDocument` kan overlappen met `ObjectFoto.isPlattegrond` | Middel — twee opslagplekken voor plattegrond | Fase 3A: documenteer regel: PDF-plattegronden → `ObjectDocument`, beeld-plattegronden → `ObjectFoto.isPlattegrond` |
| Matching | `getAllMatchesFromData()` → 0–100 score per (object × zoekprofiel) | `factoren[]`, `mismatches[]`, `globaleMatch`-label | Match obv `type`/`subcategorieId` waar `propertyTypeId` ontbreekt | Middel — drempel-inconsistentie (zie §3) | Fase 3A: centrale `STRONG_MATCH_THRESHOLD = 70` constante, hergebruik in bell + Kandidaten-sectie |
| Pipeline / dealflow | `Deal.fase` (centraal in deals-tabel) | `leadDeal` = `deals.filter(d=>d.objectId===…).sort(...)`; kandidaatcount uit pipeline-rijen | Trajectfase ook geïnfereerd uit biedingen-status in ObjectPipelineKanban | Middel — geen single function | Fase 3A: helper `selectLeadDeal(deals, objectId)` + `countKandidaten(object)` op één plek |
| Biedingen | `useBiedingen()` → `Offer` rijen | "Hoogste actief bod", "verloopt vandaag/morgen", invloed op dealfase-suggestie | — | Laag | Houden; alleen helper voor "geldt bod als trigger voor faseverhoging" |
| Notificaties | localStorage `bito-notifications-v2` + bron-derived recompute in `NotificationsBell` (`pushNotification`) | Lijst, ongelezen-tellen, sortering | `INIT_FLAG` v3 markeert init-batch als gelezen | Hoog — `STRONG_MATCH_MIN = 5` op 0–100 schaal = altijd true bij score ≥ 5 (vrijwel elke match) | Fase 3A: drempel naar 70 of expliciete schaalconversie; documenteren in code |

---

## 3. Dubbele waarheden (volledige lijst)

| # | A (kandidaat-bron) | B (kandidaat-bron) | Waar zichtbaar |
|---|---|---|---|
| 1 | `object.huurinkomsten` (jaarhuur objectniveau) | Σ `ObjectHuurder.jaarhuur` | Detail hero-KPI, Verhuur-sectie, Vastgoedrekenen-input |
| 2 | `object.aantalHuurders` | `ObjectHuurder[].length` | Verhuur-sectie, matching |
| 3 | `object.brutoAanvangsrendement` opgeslagen | `bar(jaarhuur, vraagprijs)` via `financialCalc` | Hero KPI vs Financieel-sectie vs Vastgoedrekenen |
| 4 | `object.nettoAanvangsrendement` | `nar(noi, vraagprijs)` | idem |
| 5 | `object.noi` | `correctedAnnualRent − vacancy − opex − maintenance − mgmt − other` in `computeScenario` | Financieel-sectie vs Vastgoedrekenen |
| 6 | `object.huurPerM2` | `huurPerM2(jaarhuur, oppervlakte)` | Financieel-sectie |
| 7 | `object.type` (AssetClass) | `object.propertyTypeId` | Form, matching, badges |
| 8 | `object.subcategorie` + `subcategorieId` | `propertySubtypeIds[]` | idem |
| 9 | `object.energielabel` (string) | `object.energielabelV2` (enum) | Pand-sectie, matching |
| 10 | `object.onderhoudsstaat` (string) | `object.onderhoudsstaatNiveau` (enum) | Pand-sectie |
| 11 | `object.documentenBeschikbaar: boolean` | `objectDossier`-checklist `readinessLabel` | Detail-badges, lijstfilters |
| 12 | `object.documentatieStatus[docType]` | aanwezigheid van `ObjectDocument` met dat type | IM-PDF en Documenten-sectie |
| 13 | `object.financieleScenarios` (huidig/markt/naRenovatie) | `Scenario`-rijen in Vastgoedrekenen | Vastgoedrekenen-tab vs legacy thesis |
| 14 | `ObjectDocument.documenttype='plattegrond'` | `ObjectFoto.isPlattegrond=true` | Media-tab + detail-plattegrondblok |
| 15 | `object.marktwaardeIndicatie` (handmatig) | `referentieAnalyse.mediaan` | Marktwaarde-block + referentieanalyse |
| 16 | `object.taxatiewaarde` (snapshot + datum) | `marktwaardeIndicatie` (gebruikersinvoer) | Financieel-sectie |
| 17 | "Trajectfase" via `Deal.fase` | Afgeleid uit hoogste actief bod + pipeline-rij | Deal-cockpit op Objectdetail |
| 18 | Notificatie-trigger drempel `5` (constant) | Schaal 0–100 in `getAllMatchesFromData` | Bell |

---

## 4. Derived-fields voorstel

| Veld | Formule / bron | Wanneer tonen | Wanneer verbergen | Handmatige override | Waarschuwing nodig |
|---|---|---|---|---|---|
| `maandhuur` | `jaarhuur / 12` | altijd als `jaarhuur > 0` | als jaarhuur leeg | nee | nee |
| `huurPerM2` | `jaarhuur / oppervlakteGBO` | beide > 0 | anders | nee | nee |
| `prijsPerM2` | `vraagprijs / oppervlakteGBO` | beide > 0 | anders | nee | nee |
| `BAR` | `jaarhuur / vraagprijs × 100` | beide > 0 | anders | **ja** (snapshot bij bod) | bij delta > 0.2% met opgeslagen |
| `factor` | `vraagprijs / jaarhuur` | beide > 0 | anders | nee | nee |
| `NOI` | `jaarhuur − servicekostenJaar − verwacht opex%` (objectniveau benadering) of leeg | als jaarhuur > 0 | anders | **ja** | bij groot verschil met scenario |
| `NAR` | `noi / vraagprijs × 100` | beide > 0 | anders | **ja** | idem |
| `verhuurMetrics.aantalHuurders` | `huurders.length` als ≥1, anders `object.aantalHuurders` | altijd | — | nee | als beide bestaan en verschillen |
| `verhuurMetrics.totaleJaarhuur` | `Σ huurder.jaarhuur` als huurders ≥1, anders `object.huurinkomsten` | altijd | — | nee | bij verschil > 1% |
| `WALT/WALB` | gewogen gemiddelde op `huurder.einddatum` (huur-gewogen) | als ≥1 huurder met einddatum | anders | nee | nee |
| `readinessLabel` | `computeReadiness(buildEffectiveItems)` | altijd | — | nee (subitems wel) | nee |
| `documentenBeschikbaar` | `readinessLabel !== 'niet_gereed'` (deprecated als bron) | nooit als hoofdsignaal | altijd | n.v.t. | n.v.t. |
| `leadDeal` | helper `selectLeadDeal(deals, objectId)`: actiefste deal (laatste activiteit, niet afgerond/afgevallen) | object met ≥1 deal | anders | nee | nee |
| `verwachteFee` | `Σ deal.commissieBedrag × FASE_KANS[deal.fase]` | dashboard + cockpit | — | nee | nee |
| `kandidaatCount` | aantal unieke relaties in pipeline-rijen met actieve fase + top-matches met score ≥ drempel | altijd | — | nee | nee |
| `strongMatch` | `match.score ≥ 70` (centraal) | bell + Kandidaten | — | nee | n.v.t. |

---

## 5. Legacy / migratieplan

### Fase 3A — UI/logic cleanup, géén schema-aanraking
- Centrale derivation-helpers introduceren:
  - `lib/derivations/financial.ts` (BAR/NAR/factor/€-per-m²/huur/m²/maandhuur)
  - `lib/derivations/verhuur.ts` (`deriveVerhuurMetrics(object, huurders)`)
  - `lib/derivations/deal.ts` (`selectLeadDeal`, `countKandidaten`, `verwachteFee`)
  - `lib/derivations/matching.ts` (export `STRONG_MATCH_THRESHOLD`)
- Detailpagina + form lezen overal via deze helpers; opgeslagen `brutoAanvangsrendement`/`nettoAanvangsrendement`/`huurPerM2`/`noi` worden alleen nog gelezen als **override-snapshot** met badge "handmatig".
- Mismatch-banner-component (delta tussen opgeslagen en derived) op Financieel- en Verhuur-sectie.
- Notificatie-drempel fixen (5 → 70 of schaalconversie).
- `documentenBeschikbaar` uit prominente UI; `readinessLabel` is leidend.
- `financieleScenarios` op detail: kop "Legacy snapshot" + link "Open in Vastgoedrekenen".

### Fase 3B — zachte sync / migratie zonder verlies
- Bij save in `ObjectFormDialog`: spiegel `propertyTypeId → type`/`subcategorieId` automatisch (backward compat voor matching).
- Importknop "Importeer legacy scenario naar Vastgoedrekenen": maakt `Scenario`-rij van `financieleScenarios.huidig` etc.
- Background job (client-side bij open) berekent derived snapshots en slaat opnieuw op zodat opgeslagen waarden weer kloppen — uitsluitend voor objecten met override = false.

### Fase 3C — uitfaseren (later, met schema-PR)
- Kolommen markeren als `deprecated` in `types.ts`-commentaar en uit UI/payload halen:
  `type`, `subcategorie`, `subcategorieId`, `energielabel`, `onderhoudsstaat`, `documentenBeschikbaar`, `financieleScenarios`, plus de derived-snapshot kolommen die niet als override gebruikt zijn.
- DB-migratie pas wanneer geen consumer ze meer leest.

---

## 6. Risico-inschatting per actie

| Actie | Risico |
|---|---|
| Derivation-helpers introduceren | **Laag** |
| Mismatch-banner bij object-huur vs huurders-som | **Laag** |
| Notificatie-drempel corrigeren | **Laag** (maar gedragsverandering: minder meldingen) |
| Detail-snapshots als override behandelen i.p.v. bron | **Middel** (UI-shift, gebruiker moet de override-knop begrijpen) |
| Legacy taxonomie verbergen uit form | **Middel** (matching valt nu nog terug) |
| `financieleScenarios` als legacy markeren | **Middel** (gebruikers kennen dit blok) |
| Import legacy → nieuw scenario | **Middel** |
| Documentatiestatus opnieuw labelen | **Middel** |
| Kolommen verwijderen (3C) | **Hoog** |
| Schema-migratie | **Hoog** |

---

## 7. Aanbevolen implementatievolgorde (volgende prompts)

1. **Prompt 3.1** — Bouw `lib/derivations/{financial,verhuur,deal,matching}.ts` met pure helpers + unit-tests. Geen UI-aanraking.
2. **Prompt 3.2** — Detail-pagina Financieel-sectie en hero-KPI's omschakelen naar derived; opgeslagen waarden tonen als "handmatige override" met klein badge.
3. **Prompt 3.3** — Verhuur-sectie omschakelen naar `deriveVerhuurMetrics`; mismatch-banner bij delta.
4. **Prompt 3.4** — Notificatie-drempel + matching-constante centraliseren; bell-trigger valideren in `NotificationsBell`.
5. **Prompt 3.5** — `documentenBeschikbaar` deprecated maken in UI; readiness wordt enig signaal in lijsten en badges.
6. **Prompt 3.6** — `financieleScenarios` herlabelen als "Legacy snapshot" + import-knop naar Vastgoedrekenen.
7. **Prompt 3.7** — `leadDeal`/`kandidaatCount`/`verwachteFee` overal via centrale selectors (Detail, Dashboard, Cockpit).
8. **Prompt 3.8** — Pand: legacy `energielabel`/`onderhoudsstaat` uit prominente UI; behouden als read-only fallback.
9. **Prompt 3.9** — Sync-on-save: nieuwe taxonomie spiegelt automatisch naar legacy-velden (voor matching-fallback).
10. **(Later, separate PR)** — Schema-cleanup 3C.

---

## 8. Open beslissingen (jij beslist vóór 3.x)

1. **Plan-bestand**: Fase 2-inhoud van `.lovable/plan.md` **vervangen** of **als appendix** onderaan toevoegen?
2. **Notificatiedrempel**: drempel naar **70/100** intern, of score eerst converteren naar 0–5 schaal en drempel 4 houden?
3. **Override-model voor BAR/NAR/NOI**: één globale toggle "handmatig" per object, of per veld?
4. **WALT/WALB**: huur-gewogen of m²-gewogen?
5. **`marktwaardeIndicatie` vs `referentieAnalyse`**: welke is leidend in hero/financieel — gebruikersinput wint, of mediaan wint en gebruikersinput is override?
6. **Plattegrond**: PDF-only via `ObjectDocument`, beeld via `ObjectFoto.isPlattegrond`, of alles consolideren naar één plek?
7. **Legacy scenario-import**: bij eerste opening Vastgoedrekenen automatisch importeren met dialog, of alleen handmatige knop?
8. **`object.aantalHuurders` als override**: behouden voor objecten zonder huurder-rijen, of altijd derive (en 0 tonen)?
9. **Mismatch-banners**: hard-blocker (save weigeren) of soft (alleen tonen)?
10. **Welke acties uit §7 wil je in **één** Fase 3A-PR samenvoegen** versus apart?

---

> Zodra je deze beslissingen hebt aangegeven, kan ik in build-mode dit rapport in `.lovable/plan.md` zetten en daarna direct met Prompt 3.1 starten.
