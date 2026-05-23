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
