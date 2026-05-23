# Fase 2 — Herstructurering Object bewerken & Objectdetail

Doel: velden hergroeperen tot een logische tab- en sectie-indeling die voor zowel bewerken als detailpagina identiek aanvoelt. Geen schemawijzigingen, geen velden verwijderen, geen datamigraties. Legacy-velden blijven beschikbaar maar worden minder prominent.

## Aanpak in het kort

- `ObjectFormDialog.tsx` (~1620 regels) krijgt nieuwe tab-indeling. Bestaande veld-componenten worden verplaatst tussen tabs, niet herschreven.
- `ObjectDetailPage.tsx` (~1940 regels) krijgt herziene secties + bijbehorende `SECTIONS` anchor-lijst zodat sticky sectiebar en scrollspy blijven kloppen.
- Read-only afgeleide velden (huur/mnd, totaal m² na plan, totaal units na plan) gebruiken de bestaande compute-helpers; geen nieuwe state.
- "Alleen tonen indien gevuld" regel wordt consequent toegepast in detailblokken Potentie, Contacten, Aanbieding & proces.

## 1. Object bewerken — nieuwe tabstructuur

Huidig: Algemeen · Financieel · Verhuur · Pand · Juridisch · Verkoper · Thesis · IM & document · Media (9)
Nieuw: Algemeen · Financieel · Verhuur · Pand · **Potentie** · Juridisch · **Contacten** · **Aanbieding & dossier** · Media (9)

Wijzigingen per tab:

| Tab | Wat erin komt | Vanwaar verplaatst |
|---|---|---|
| Algemeen | titel, intern ref, status, aanbiedingswijze, bron, exclusief, anoniem, publieke naam/regio, adres, postcode, plaats, provincie, propertyTypeId, propertySubtypeIds, dealTypeIds, beschikbaarVanaf | `huidigGebruik` verhuist naar Verhuur |
| Financieel | vraagprijs, prijsindicatie, jaarhuur, **huur/mnd (derived)**, huur/m², servicekosten, NOI, BAR, NAR, factor, WOZ + peildatum, taxatie + datum, **marktwaardeIndicatie**, **marktwaardeBron** | marktwaarde-velden uit IM-tab |
| Verhuur | verhuurStatus, **huidigGebruik**, aantalHuurders, leegstandPct, WALT/WALB indien aanwezig | huidigGebruik uit Algemeen |
| Pand | oppervlakte + VVO/BVO/GBO, perceel, **oppervlaktenPerVerdieping**, bouwjaar, energielabelV2, verdiepingen, units, onderhoudsstaatNiveau, recenteInvesteringen, achterstalligOnderhoud, asbestinventarisatieAanwezig, **technischeStaatOmschrijving** | oppervlaktenPerVerdieping + technischeStaatOmschrijving uit IM |
| **Potentie (nieuw)** | ontwikkelPotentie, transformatiePotentie, potentieOmschrijving, mogelijkeStrategie, huidige m² (read-only kopie van Pand.oppervlakte), extra m², totaal m² na plan (read-only), huidige units, extra units, totaal units (read-only), onderbouwingStatus, potentieBron, afhankelijkheden/risico's | uit Pand |
| Juridisch | ongewijzigd |
| **Contacten (nieuw, vervangt Verkoper)** | Sectie "Verkoper / eigenaar / aanbieder": verkoperNaam, verkoperRol, verkoperVia, verkoperTel, verkoperEmail, verkoopmotivatie. Sectie "Objectcontact / makelaar": contactNaam, contactFunctie, contactTel, contactEmail | contact-velden uit IM-tab |
| **Aanbieding & dossier (vervangt Thesis + IM)** | samenvatting, investeringsthese, onderscheidendeKenmerken, risico's, opmerkingen, interneOpmerkingen, propositie, objectomschrijving, locatieOmschrijving, **procesVoorwaarden**, **dataroomUrl**, **imSectiesZichtbaar**, **referentieanalyseZichtbaar**, PDF-zichtbaarheid | proces/data/zichtbaarheid uit IM |
| Media | ongewijzigd |

Legacy: `type`, `subcategorie`, `documentenBeschikbaar` blijven in state/payload maar krijgen geen prominente edit-UI (verborgen of als kleine "Legacy" hint onder geavanceerd).

## 2. Potentie — afgeleide totalen

- Totaal m² na plan = (Pand.oppervlakte ?? 0) + (extraM2 ?? 0) → read-only veld.
- Totaal units na plan = (Pand.aantalUnits ?? 0) + (extraUnits ?? 0) → read-only veld.
- Beide tonen alleen waarde als minstens één bron > 0; anders "—".
- Geen NaN/Infinity (guards op number-conversies).

## 3. Objectdetailpagina — nieuwe sectie-indeling

Nieuwe `SECTIONS` lijst (id → label):

```
overzicht        → Overzicht (Identificatie + Locatie + Classificatie)
financieel       → Financieel  (incl. marktwaarde + WOZ + taxatie)
verhuur          → Verhuur     (status, huurders, WALT/WALB)
pand             → Pand & staat (opp, opp/verdieping, bouw, energie, onderhoud, asbest, technische staat)
potentie         → Potentie     (conditioneel: alleen tonen als data aanwezig)
juridisch        → Juridisch    (eigendom, erfpacht, bestemming, kadaster)
contacten        → Contacten    (conditioneel: verkoper + objectcontact)
aanbieding       → Aanbieding   (samenvatting, these, propositie, omschrijvingen, proces, dataroom, zichtbaarheid)
dossier          → Dossierstatus (readiness uit objectDossier)
kandidaten       → Kandidaten
dealflow         → Dealflow
biedingen        → Biedingen
documenten       → Documenten & foto's
vastgoedrekenen  → Vastgoedrekenen
activiteit       → Activiteit
```

- Sticky sectiebar + scrollspy gebruiken dezelfde lijst → geen dubbele anchors, geen drift.
- Mobile-only items (deal-cockpit, next-action, quick-actions) blijven appended.
- Conditionele secties (potentie, contacten) worden uit `SECTIONS` gefilterd op runtime als hun data leeg is, zodat sectiebar en scrollspy synchroon blijven.

## 4. "Alleen tonen indien gevuld"

- Potentie-blok: render alleen als minstens één potentie-veld waarde heeft.
- Contacten-blok: render alleen als verkoper- of contact-velden gevuld zijn.
- Aanbieding & proces: lege tekstblokken krijgen geen kaart; alleen de gevulde subblokken.
- Bestaande detail-helpers (`KV`, `formatGetal`, etc.) garanderen geen NaN/Infinity.

## 5. Wat niet verandert

- Geen kolommen toegevoegd/verwijderd in DB.
- Geen aanpassing aan `useDataStore`, `mock-data.ts` interfaces, of Supabase types.
- Referentieanalyse, Vastgoedrekenen-tab, Biedingen/Pipeline-secties blijven inhoudelijk gelijk.
- Auto/handmatig badges van Fase 1 blijven werken.
- PDF en matching lezen dezelfde velden — verplaatsing is puur UI.

## Technische details

Bestanden:

- `src/components/forms/ObjectFormDialog.tsx`
  - Tab-trigger lijst aanpassen (9 tabs, nieuwe volgorde + labels).
  - `<TabsContent value="…">` blokken hergroeperen door bestaande JSX-stukken te knippen/plakken tussen tabs. Geen logica-changes.
  - Nieuwe tab "potentie": uitlichten in eigen TabsContent + 2 read-only inputs voor totalen die `useMemo` over form-state berekenen.
  - Tab "contacten": twee subsecties met bestaande verkoper-/contact-input groepen samen.
  - Tab "aanbieding": thesis + IM-tekstblokken + proces/data/zichtbaarheid samen.
  - Legacy `type`/`subcategorie` velden verbergen achter `<details>Geavanceerd / legacy</details>` in Algemeen.

- `src/pages/ObjectDetailPage.tsx`
  - `SECTIONS` array herschrijven.
  - Bestaande JSX-secties herschikken in nieuwe `<SectionAnchor>` blokken; sommige bestaande titels splitsen (bv. "Aanbieding & proces" → eigen sectie, los van "Overzicht").
  - Nieuwe component-helpers lokaal:
    - `hasPotentieData(obj)` → bool
    - `hasContactenData(obj)` → bool
  - `SECTIONS` runtime-filter: `SECTIONS.filter(s => s.id !== 'potentie' || hasPotentieData(obj))` enz.
  - Scroll-spy code blijft hetzelfde; werkt op gefilterde lijst.

Acceptatie:

- TypeScript schoon.
- Build groen.
- Sticky sectiebar toont alleen secties die ook daadwerkelijk renderen.
- Geen horizontale overflow op mobiel (sectiebar is al horizontale scroller).
- Light/dark mode ongewijzigd (alleen semantic tokens gebruikt).
- Geen veldverlies: alle bestaande velden in form-state en payload behouden.

---

# Appendix — Fase 3: Bron van waarheid & datalogica

> Status: analyse afgerond, beslissingen genomen. **Geen schema- of datamigraties.** Implementatie start met Prompt 3.1 (alleen pure helpers, geen UI).

## A1. Samenvatting

De codebase bevat meerdere parallelle "waarheden" voor dezelfde gegevens. Belangrijkste risico's:

1. **Financiële KPI's** (BAR/NAR/factor/huurPerM2/NOI) staan als opgeslagen velden op `ObjectVastgoed` terwijl `lib/financialCalc.ts` en `lib/vastgoedrekenen/compute.ts` dezelfde getallen kunnen afleiden. Snapshots kunnen verouderen.
2. **Taxonomie**: `type` + `subcategorie` + `subcategorieId` (legacy) leven naast `propertyTypeId` + `propertySubtypeIds` + `dealTypeIds`. Matching valt nog terug op legacy.
3. **Pand**: `energielabel` naast `energielabelV2`; `onderhoudsstaat` naast `onderhoudsstaatNiveau`.
4. **Verhuur**: `object.aantalHuurders`/`huurinkomsten`/`leegstandPct` versus `ObjectHuurder[]` rijen + `ObjectHuurMetrics`.
5. **Scenario's**: `object.financieleScenarios` (inline) bestaat naast de volwaardige Vastgoedrekenen-engine.
6. **Documenten**: `documentenBeschikbaar` + `documentatieStatus` + `ObjectDocument[]` + dossier-checklist + Media → vier bronnen voor "is doc X aanwezig".
7. **Notificaties**: drempel `STRONG_MATCH_MIN = 5` op een 0–100 score → bug: vrijwel elke match telt als "sterk".
8. **Dealflow/lead deal/fee**: ad-hoc afgeleid op detailpagina, geen centrale selector.

Conclusie: primair een **derivation- en bron-probleem**, niet een schema-probleem.

## A2. Beslissingen (uit §8)

1. Plan-bestand: Fase 3 als **appendix** onderaan, Fase 2 blijft intact.
2. Notificatiedrempel: **70/100** intern. Schaal blijft 0–100, geen conversie naar 0–5.
3. Override-model: **per veld** (BAR, NAR en NOI elk afzonderlijk auto of handmatig).
4. WALT/WALB: **huur-gewogen** berekening.
5. Marktwaarde: `marktwaardeIndicatie` (gebruikersinput) **wint als handmatige override**. Referentieanalyse/mediaan blijft indicatief/adviserend.
6. Plattegronden: **niet consolideren**. PDF → `ObjectDocument` (`documenttype='plattegrond'`), beeld → `ObjectFoto.isPlattegrond=true`. Regel documenteren in derivation-helpers en in `DocumentenPanel`/`FotosPanel` JSDoc.
7. Legacy scenario-import: **geen automatische import**. Alleen handmatige knop "Importeer legacy scenario naar Vastgoedrekenen".
8. `object.aantalHuurders`: **fallback** bij geen huurder-rijen. Zodra huurder-rijen bestaan, afleiden uit huurdersregels.
9. Mismatch-banners: **soft warning**. Geen save-blokkade.
10. Volgorde: start met **Prompt 3.1** als geïsoleerde, veilige stap (alleen helpers, geen UI, geen schema, geen migratie).

## A3. Bronnen van waarheid per domein

| Domein | Leidend | Derived | Legacy / fallback | Risico | Actie |
|---|---|---|---|---|---|
| Object stamdata | titel, adres, status, internNummer | publiekeNaam | bron vs aanbiedingswijze | Laag | — |
| Taxonomie | propertyTypeId, propertySubtypeIds, dealTypeIds | labels via useTaxonomie | type, subcategorie, subcategorieId | Middel | 3B sync, 3C verbergen |
| Pand / energie | energielabelV2, onderhoudsstaatNiveau, bouwjaar, oppervlaktes, units, verdiepingen | — | energielabel, onderhoudsstaat | Laag | 3A read-only, 3C weglaten |
| Financieel | vraagprijs, jaarhuur, servicekosten, WOZ, taxatie, oppervlakteGBO, marktwaardeIndicatie | maandhuur, €/m², huur/m², BAR, factor (puur derived); NOI, NAR (derived **met per-veld override**) | prijsindicatie | Hoog | 3A derive-on-render |
| Verhuur / huurders | `ObjectHuurder[]` als ≥1 | aantalHuurders, totaleJaarhuur, verhuurdeM2, WALT, WALB (huur-gewogen) | object.aantalHuurders, huurinkomsten, leegstandPct als fallback | Hoog | 3A `deriveVerhuurMetrics` + soft-warning |
| Vastgoedrekenen | scenario + componenten + costs + WWS + tax via `computeScenario()` | maximumBid, BAR/factor/NAR, NOI, dealScore | `object.financieleScenarios` | Hoog | 3A markeer als legacy, handmatige import-knop (3B) |
| Dossier / docs | dossier-checklist `computeReadiness` | readinessLabel, score, missingCritical | documentenBeschikbaar, documentatieStatus | Middel | 3A documentenBeschikbaar niet prominent |
| Media | ObjectDocument + ObjectFoto | sectie-rendering | overlap plattegrond | Middel (bewust geaccepteerd) | Regel documenteren, niet consolideren |
| Matching | `getAllMatchesFromData()` 0–100 | factoren, mismatches, label | type/subcategorieId fallback | Middel | 3A `STRONG_MATCH_THRESHOLD = 70` constante |
| Pipeline / dealflow | Deal.fase | leadDeal, kandidaatcount via helpers | trajectfase geïnfereerd uit biedingen | Middel | 3A `selectLeadDeal`, `countKandidaten` |
| Biedingen | useBiedingen Offer-rijen | hoogste actief bod, verloopt vandaag/morgen | — | Laag | — |
| Notificaties | localStorage + bron-derived recompute | sortering, ongelezen-tellen | INIT_FLAG | Hoog (drempel-bug) | 3A drempel = 70 |

## A4. Dubbele waarheden (samenvatting)

1. object.huurinkomsten ↔ Σ huurder.jaarhuur
2. object.aantalHuurders ↔ huurders.length
3. object.brutoAanvangsrendement ↔ `bar(jaarhuur, vraagprijs)`
4. object.nettoAanvangsrendement ↔ `nar(noi, vraagprijs)`
5. object.noi ↔ NOI uit scenario
6. object.huurPerM2 ↔ `huurPerM2(jaarhuur, opp)`
7. type ↔ propertyTypeId
8. subcategorie/subcategorieId ↔ propertySubtypeIds
9. energielabel ↔ energielabelV2
10. onderhoudsstaat ↔ onderhoudsstaatNiveau
11. documentenBeschikbaar ↔ readinessLabel
12. documentatieStatus[type] ↔ ObjectDocument met type
13. financieleScenarios ↔ Scenario-rijen
14. ObjectDocument 'plattegrond' ↔ ObjectFoto.isPlattegrond *(bewust geaccepteerd)*
15. marktwaardeIndicatie ↔ referentieanalyse-mediaan *(gebruikersinput wint)*
16. taxatiewaarde ↔ marktwaardeIndicatie
17. Deal.fase ↔ afgeleid uit hoogste actief bod
18. STRONG_MATCH_MIN=5 op 0–100 schaal *(fix → 70)*

## A5. Derived-fields voorstel (definitief)

| Veld | Formule | Override | Waarschuwing |
|---|---|---|---|
| maandhuur | jaarhuur / 12 | nee | nee |
| huurPerM2 | jaarhuur / oppGBO | nee | nee |
| prijsPerM2 | vraagprijs / oppGBO | nee | nee |
| BAR | jaarhuur / vraagprijs × 100 | **ja, per veld** | bij delta > 0.2% met opgeslagen |
| factor | vraagprijs / jaarhuur | nee | nee |
| NOI | jaarhuur − servicekosten − verwacht opex% | **ja, per veld** | bij groot verschil met scenario |
| NAR | noi / vraagprijs × 100 | **ja, per veld** | idem |
| verhuurMetrics.aantalHuurders | huurders.length, anders object.aantalHuurders | fallback | bij verschil |
| verhuurMetrics.totaleJaarhuur | Σ huurder.jaarhuur, anders object.huurinkomsten | fallback | delta > 1% |
| WALT/WALB | **huur-gewogen** gemiddelde resterende looptijd | nee | nee |
| readinessLabel | computeReadiness(buildEffectiveItems) | nee | nee |
| documentenBeschikbaar | readinessLabel !== 'niet_gereed' (deprecated) | n.v.t. | n.v.t. |
| leadDeal | `selectLeadDeal(deals, objectId)` | nee | nee |
| verwachteFee | Σ deal.commissieBedrag × FASE_KANS[fase] | nee | nee |
| kandidaatCount | unieke relaties in pipeline-rijen met actieve fase + top-matches ≥ drempel | nee | nee |
| strongMatch | match.score ≥ 70 (constante) | nee | n.v.t. |
| marktwaarde-effectief | `marktwaardeIndicatie` als gevuld, anders referentie-mediaan | input wint | bij grote afwijking met mediaan |

## A6. Fasering

### Fase 3A — UI/logic cleanup, geen schema
- `lib/derivations/financial.ts` — pure helpers; per-veld override-resolver (`resolveBar`, `resolveNoi`, `resolveNar`) die `{ value, source: 'auto'|'override', delta }` teruggeven.
- `lib/derivations/verhuur.ts` — `deriveVerhuurMetrics(object, huurders)`; WALT/WALB huur-gewogen; mismatch-detectie.
- `lib/derivations/deal.ts` — `selectLeadDeal`, `countKandidaten`, `verwachteFee`.
- `lib/derivations/matching.ts` — `STRONG_MATCH_THRESHOLD = 70`.
- `lib/derivations/marktwaarde.ts` — `resolveMarktwaarde(object, referentieMediaan)` (input wint).
- Detail-pagina en form gebruiken helpers; opgeslagen kolommen alleen als override-snapshot met badge.
- Mismatch-banners als **soft warning** (geen save-blokkade).
- Notificatie-drempel `STRONG_MATCH_MIN` → 70.
- `documentenBeschikbaar` uit prominente UI; `readinessLabel` leidend.
- `financieleScenarios` op detail: kop "Legacy snapshot" + handmatige import-knop.
- Plattegrond-regel documenteren in JSDoc.

### Fase 3B — zachte sync zonder verlies
- On-save spiegel `propertyTypeId → type` / `propertySubtypeIds → subcategorieId` (matching backward-compat).
- Handmatige knop "Importeer legacy scenario naar Vastgoedrekenen".
- Optionele resnapshot van derived kolommen wanneer override = false.

### Fase 3C — uitfaseren (latere PR met schema-PR)
- Markeer als deprecated in types: `type`, `subcategorie`, `subcategorieId`, `energielabel`, `onderhoudsstaat`, `documentenBeschikbaar`, `financieleScenarios`, en derived-snapshot-kolommen zonder override.
- Schema-migratie pas wanneer geen consumer ze meer leest.

## A7. Risico-inschatting

| Actie | Risico |
|---|---|
| Derivation-helpers introduceren (3.1) | Laag |
| Mismatch-banners (soft) | Laag |
| Notificatie-drempel naar 70 | Laag (minder ruis verwacht) |
| Per-veld override-model in detail/form | Middel |
| Legacy taxonomie verbergen | Middel |
| `financieleScenarios` als legacy | Middel |
| Handmatige scenario-import | Middel |
| Documentatiestatus relabelen | Middel |
| Schema-cleanup (3C) | Hoog |

## A8. Implementatievolgorde (prompts)

1. **Prompt 3.1** — *Volgende, veilige stap*: bouw `lib/derivations/{financial,verhuur,deal,matching,marktwaarde}.ts` als **pure helpers + selectors**. Inclusief per-veld override-resolver-types, huur-gewogen WALT/WALB, `STRONG_MATCH_THRESHOLD = 70`. **Geen UI-aanraking, geen import elders, geen schemawijziging, geen migratie.** Unit-tests in `src/test/derivations/*.test.ts`. TypeScript/build schoon. Bestaand gedrag ongemoeid.
2. Prompt 3.2 — Detail Financieel + hero-KPI's via helpers; per-veld override-badges.
3. Prompt 3.3 — Verhuur-sectie via `deriveVerhuurMetrics`; soft mismatch-banner.
4. Prompt 3.4 — Notificatie-drempel + matching-constante centraliseren in bell.
5. Prompt 3.5 — `documentenBeschikbaar` deprecated in UI; readiness leidend.
6. Prompt 3.6 — `financieleScenarios` als "Legacy snapshot" + handmatige import-knop.
7. Prompt 3.7 — `leadDeal` / `kandidaatCount` / `verwachteFee` via centrale selectors (Detail, Dashboard, Cockpit).
8. Prompt 3.8 — Pand: legacy energielabel/onderhoudsstaat alleen read-only fallback.
9. Prompt 3.9 — On-save sync nieuwe → legacy taxonomie (matching-fallback).
10. (Later, separate PR) — Schema-cleanup 3C.

---

## A9. Prompt 3.1 — uitgevoerd

Centrale pure helpers + selectors toegevoegd. **Geen UI, geen schema, geen migratie.**

Bestanden:

- `src/lib/derivations/financial.ts` — `safeNumber`, `safeDivide`, `calculateMonthlyRent`, `calculateAnnualFromMonthly`, `calculatePricePerM2`, `calculateRentPerM2`, `calculateBAR`, `calculateFactor`, `calculateNAR`, `resolveDerived`, `resolveBAR`, `resolveNAR`, `resolveNOI` (per-veld override-model met `{ value, source, auto, override, delta, mismatch }`).
- `src/lib/derivations/verhuur.ts` — `deriveVerhuurMetrics(object, huurders, { today? })`, `hasRentMismatch`, `hasTenantCountMismatch`, constante `RENT_MISMATCH_THRESHOLD = 0.01`. Huurder-rijen leidend bij ≥1 rij, anders objectniveau-fallback. WALT/WALB **huur-gewogen**.
- `src/lib/derivations/matching.ts` — `STRONG_MATCH_THRESHOLD = 70` (0–100 schaal, geen conversie), `EXCELLENT_MATCH_THRESHOLD = 85`, `isStrongMatch`, `isExcellentMatch`.
- `src/lib/derivations/deal.ts` — `selectLeadDeal`, `calculateExpectedFee`, `countKandidaten`, `getActivePipelineCandidates`, `isActiveDealFase`. Gebruikt bestaande `FASE_KANS` uit `mock-data.ts`.
- `src/lib/derivations/index.ts` — barrel-export.

Tests (`src/test/derivations/*.test.ts`): **36 / 36 groen**.

Niet aangeraakt: UI-componenten, `NotificationsBell`, `ObjectFormDialog`, `ObjectDetailPage`, schema, types, mock-data. De oude `STRONG_MATCH_MIN = 5` constante in `NotificationsBell` blijft staan tot Prompt 3.4.

Volgende stappen 3.2 t/m 3.9 blijven ongewijzigd zoals beschreven in §A8.

---

## Prompt 3.2 — Objectdetail financiële KPI's via centrale helpers (uitgevoerd)

**Scope:** `src/pages/ObjectDetailPage.tsx` (hero-KPI's + Financieel-sectie).
**Niet aangeraakt:** schema, types, mock-data, Vastgoedrekenen, ObjectFormDialog, scenario-engine.

### Wijzigingen
- Inline BAR/NAR/NOI/Factor/maandhuur/huur-per-m²-berekeningen vervangen door imports uit `@/lib/derivations`:
  - `resolveBAR`, `resolveNAR`, `resolveNOI`, `resolveDerived`
  - `calculateFactor`, `calculateMonthlyRent`, `calculateRentPerM2`
- Hero-KPI-strip en Financieel-sectie gebruiken nu dezelfde `barEffect`/`narEffect`/`noiEffect`/`factor`/`huurPerM2*` waarden → bron is identiek.
- AUTO/HANDMATIG-badges blijven gestuurd door `source === 'override'` (was `object.<veld> != null`); semantiek ongewijzigd.
- `eurPerM2` import uit `@/data/mock-data` verwijderd (vervangen door `calculateRentPerM2`).

### Override-snapshot keuze
Opgeslagen `brutoAanvangsrendement`, `nettoAanvangsrendement`, `noi` en `huurPerM2` worden behandeld als **handmatige snapshot** (override). Auto-derived waarde wordt alleen getoond als override ontbreekt. Geen schemavlag nodig — bestaande null/non-null bepaalt het.

### Prijsindicatie
`prijsindicatie` blijft puur tekstuele fallback in de Vraagprijs-tile. Wordt nergens in BAR/NAR/factor/€-m²-berekening gebruikt (helpers krijgen alleen `object.vraagprijs`).

### Mismatch / soft warnings
`resolveDerived` levert al `delta` en `mismatch` (tolerantie 0.2% relatief). UI toont nu nog géén warning-chip; opgenomen als vervolg in **Prompt 3.3** (voorstel: subtiele chip bij `mismatch && source==='override'` op BAR/NAR/NOI/huurPerM2-tiles).

### Validatie
- 36 derivation-tests groen.
- TypeScript build schoon.
- Geen schemawijziging, geen migratie, geen data overschreven.

## Prompt 3.3 — Verhuur-sectie + huurders-KPI's via centrale verhuur-helper

### Scope
Verhuur-sectie en hero huurders-KPI's op Objectdetail gebruiken nu `deriveVerhuurMetrics` uit `src/lib/derivations/verhuur.ts`. Huurdersregels zijn leidend zodra aanwezig; objectniveau-velden (`aantalHuurders`, `huurinkomsten`, `leegstandPct`) blijven fallback.

### Wijzigingen
- `ObjectDetailPage.tsx`:
  - `deriveVerhuurMetrics(object, huurders)` als centrale bron; legacy `store.getHuurMetrics(object.id)` niet meer geconsumeerd op detail (store-veld blijft bestaan voor andere modules).
  - Hero WALT/WALB-strip toont nu `verhuur.aantalHuurders`, `waltJaren.toFixed(1)`, `walbJaren.toFixed(1)`.
  - Verhuur-sectie: aantal huurders, leegstand en totale jaarhuur via `verhuur.*`. Label wordt "(indicatie)" als bron `object` is.
  - "Totale jaarhuur"-tile bevat nu maandhuur als sub-hint (`/mnd`).
  - Soft mismatch-banners (AlertCircle, amber-500, klein) bij `warnings.rentMismatch` of `warnings.tenantCountMismatch`; alleen zichtbaar als huurdersregels bestaan. Geen save-blokker.
- `ObjectFormDialog.tsx`:
  - Label "Aantal huurders (aggregaat)" → "Aantal huurders (fallback)" + helpertekst.
  - Helpertekst onder "Totale huurinkomsten (€/jr)" markeert het als fallback/indicatie.
  - Geen schemawijziging; objectvelden blijven schrijfbaar en worden niet automatisch overschreven door huurdersregels.

### Validatie
- Bestaande 8 verhuur-tests + overige 28 derivation-tests groen (36 totaal).
- TypeScript build schoon.
- Geen schemawijziging, geen migratie, geen data overschreven.

### Open punten
- Deal Cockpit en lijstweergaves (ObjectenPage) consumeren nog `object.huurinkomsten`/`object.aantalHuurders` direct; centraliseren in volgende prompt.
- `store.huurMetrics` (DB-view) wordt nog niet gebruikt door Objectdetail; later kunnen we kiezen om de view geheel te vervangen door client-side derivation of beide te valideren.

---

## Prompt 3.4 — Dossier / Documenten / Media als bron van waarheid

### Wijzigingen
- **Documenten-sectie zichtbaarheid** (`ObjectDetailPage.tsx`): conditie versmald van
  `documenten.length > 0 || fotos.length > 1` naar `documenten.length > 0`. Een gewone
  hero-foto of fotogalerij activeert de Documenten-sectie niet langer. Foto-galerij-blok
  intern uit Documenten-sectie verwijderd; media-beheer loopt via Object bewerken → Media-tab.
- **Pand-sectie**: fallback-rij "Documentatie: Beschikbaar" (op basis van legacy
  `documentenBeschikbaar`) verwijderd. Dossier-readiness (sectie Dossierstatus) is de
  leidende bron voor documentstatus.
- **Aanbieding & proces**: `documentatieStatus` blijft als tekstuele toelichting onder
  "Documentatie-overzicht" (legacy/context), niet leidend voor readiness.
- **Documenten-sectie** krijgt per groep (Documenten / Plattegronden) een kleine
  "Beheren"-link die `openEdit('media')` aanroept.
- **Quick Action "Document uploaden"** opent nu Object bewerken → Media-tab in plaats van
  Dossier-tab Documenten.

### Niet gewijzigd
- Geen schemawijzigingen, geen migraties, geen bestaande data overschreven.
- `documentenBeschikbaar` en `documentatieStatus` blijven bestaan als legacy-velden.
- Media-tab in `ObjectFormDialog` is al gesplitst in Foto's / Plattegronden / Documenten
  (Plattegronden gebruiken `DocumentenPanel` met `defaultType="plattegrond"` —
  blijven dus los van gewone foto's).
- Hoofdnummering ongewijzigd: Documenten staat in `UNNUMBERED_SECTIONS` en telt niet mee.

### Open punten
- `documentenBeschikbaar` en `documentatieStatus` kunnen in een latere prompt volledig
  gedeprecateerd worden (UI + ObjectFormDialog veld weghalen) zodra dossier-checklist
  volledig de bron is.
- Lijstweergaven (ObjectenPage) tonen mogelijk nog `documentenBeschikbaar`-icoontjes;
  evalueren in latere prompt.
