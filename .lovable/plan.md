# App-brede zoek-, filter- en sorteerlogica

## Doel
Eén consistente UX voor zoeken, filteren en sorteren over alle lijst-pagina's, met module-specifieke "slimme volgorde" en herbruikbare helpers.

## Aanpak

### 1. Centrale infrastructuur (nieuw)

**`src/lib/sorting/types.ts`** — Gedeelde types:
- `SortOption<T>` = `{ value: string; label: string; compare: (a: T, b: T) => number }`
- `SortConfig<T>` = `{ moduleKey: string; options: SortOption<T>[]; defaultValue: string }`

**`src/lib/sorting/comparators.ts`** — Null-safe basisvergelijkers:
- `byString(getter)`, `byNumber(getter, dir)`, `byDate(getter, dir)`
- `combine(...comparators)` voor multi-key sortering
- Nulls altijd achteraan, ongeacht richting.

**`src/lib/sorting/urgency.ts`** — Domeinhelpers (hergebruiken van bestaande `relatieContact.ts`, `taakHelpers.ts`):
- `getTaakUrgencyBucket(taak, now)` → 0=telaat, 1=vandaag, 2=morgen, 3=dezeWeek, 4=later, 5=zonderDatum, 6=wachten, 7=afgerond
- `getTaakPrioriteitRank(prio)` → 0=kritiek/hoog, 1=normaal, 2=laag
- `getRelatieSmartBucket(relatie, contactMoments, taken)` → 0=openActie, 1=warm/actief, 2=recentContact, 3=geenContact, 4=overig, 5=archief
- `getObjectSmartBucket(obj, ...)`, `getDealSmartBucket(deal, ...)`, etc.

**`src/hooks/useSortPreference.tsx`** — Persisteert keuze per module in `localStorage` (`sort-pref:<moduleKey>`).

**`src/components/SortDropdown.tsx`** — UI-component:
- Mobiel: compacte trigger-knop met label "Sorteer: {huidige}" + dropdown (gebruikt shadcn `DropdownMenu`).
- Desktop: zelfde, iets ruimer (h-10).
- Props: `value`, `onChange`, `options`.

### 2. Module-implementaties

Per pagina:
1. Definieer `sortOptions` (met `compare` functies die centrale helpers gebruiken).
2. Vervang/plug `<SortDropdown>` naast bestaande zoek/filter-controls.
3. Pas `filtered` aan: `filtered.slice().sort(activeOption.compare)`.
4. Gebruik `useSortPreference("<moduleKey>", defaultValue)`.

Te updaten pagina's en hun standaard slimme volgorde:

| Module | Pagina | Default | Belangrijkste opties |
|---|---|---|---|
| Taken | `TakenPage.tsx` | Slim (urgency bucket + prio + tijd) | Deadline ↑↓, Prioriteit, Status, Type, Relatie A-Z, Laatst gewijzigd, Nieuwste |
| Relaties | `RelatiesPage.tsx` | Slim (open actie → warm → recent contact → geen → archief) | Bedrijf/Contact A-Z, Laatste contact ↑↓, Volgende actie, Nieuwste, Laatst gewijzigd, Warmste, Geen recent contact |
| Objecten | `ObjectenPage.tsx` | Slim (actief → volg.actie/kandidaten → recent bijgewerkt → nieuwste) | Nieuwste, Laatst gewijzigd, Vraagprijs ↑↓, Plaats A-Z, Status, Fase, Type, # kandidaten |
| Deals | `DealsPage.tsx` | Slim (actief+open actie → urgentie → gewogen commissie → bijgewerkt) | Volg. actie, Laatste contact, Dealwaarde, Commissie, Gewogen commissie, Fase, Status, Laatst gewijzigd, Nieuwste |
| Zoekprofielen | `ZoekprofielenPage.tsx` | Slim (actief → recent → prioriteit → nieuwste) | Nieuwste, Laatst gewijzigd, Budget ↑↓, Regio, Type, Relatie A-Z |
| Acquisitie | `AcquisitiePage.tsx` | Slim (volg. actie → warm → laatste contact → nieuwste) | Volg. actie, Warmste, Laatste contact, Status, Campagne, Bedrijf A-Z, Nieuwste, Laatst gewijzigd |
| Referentieobjecten | `ReferentieObjectenPage.tsx` | Laatst gewijzigd | Nieuwste, Plaats A-Z, Prijs ↑↓, Prijs/m² ↑↓, Type, Bouwjaar, Oppervlakte |
| Pipeline | `PipelinePage.tsx` + kanban componenten | Fase blijft hoofdstructuur; binnen fase: Volg. actie | Laatste activiteit, Interessegraad, Matchscore, Bieding, Laatst gewijzigd |

### 3. UX-details

- Sorteer-dropdown altijd rechts van de filter-rij, op één lijn op desktop, eronder/inline op mobiel.
- Trigger toont "Sorteer: {label}".
- Sortering wordt toegepast **na** zoeken en filteren (op `filtered`-array).
- Null-safe: ontbrekende velden (datum, prijs, contact) altijd onderaan.
- Geen horizontale overflow op mobiel (393px viewport).
- Pipeline: dropdown per fase-kolom of één globale "binnen fase"-keuze (één globale, simpeler).

### 4. Niet in scope

- Rapportage: alleen waar lijst-achtige tabellen staan; geen wijziging aan grafieken/aggregaties.
- Geen database/backend wijzigingen — puur frontend sortering op reeds geladen data.
- Geen wijzigingen aan "Laatste contact"-definitie (blijft echte contactmomenten, conform eerdere rondes).

## Technische details

- `localStorage`-key: `sort-pref:<moduleKey>` met fallback naar `defaultValue` als ongeldig.
- Comparators puur (geen side-effects), getypeerd per entiteit (`Taak`, `Relatie`, `ObjectVastgoed`, `Deal`, …).
- "Slimme volgorde" = `combine(byBucket, byPrioriteit/urgency, byTijd/datum)`.
- Taken-tijdlogica: `isTelaat(taak, now)` checkt zowel datum als optioneel tijd (`HH:MM`) — vandaag 16:00 is pas te laat ná 16:00.
- Hergebruik `getLaatsteContactDatum`, `getVolgendeOpenTaak` uit `relatieContact.ts`.
- Bestaande filter/zoek-UI blijft; alleen `SortDropdown` wordt toegevoegd.

## Bestanden

**Nieuw:**
- `src/lib/sorting/comparators.ts`
- `src/lib/sorting/urgency.ts`
- `src/lib/sorting/types.ts`
- `src/hooks/useSortPreference.tsx`
- `src/components/SortDropdown.tsx`

**Aangepast:**
- `src/pages/TakenPage.tsx`
- `src/pages/RelatiesPage.tsx`
- `src/pages/ObjectenPage.tsx`
- `src/pages/DealsPage.tsx`
- `src/pages/ZoekprofielenPage.tsx`
- `src/pages/AcquisitiePage.tsx`
- `src/pages/ReferentieObjectenPage.tsx`
- `src/pages/PipelinePage.tsx` (+ evt. `ObjectPipelineKanban.tsx` / `KandidatenKanban.tsx` voor binnen-fase sortering)
