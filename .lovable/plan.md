## Doel

Status/fase/archief logica volledig herstructureren voor Objecten en Deals, en bug fixen waarbij Verkocht/Ingetrokken objecten in Actief blijven staan.

## 1. Database migratie (Supabase)

**Enum `object_status` aanpassen**
Nieuwe waarden: `te_beoordelen`, `beschikbaar`, `on_hold`, `onder_optie`, `verkocht`, `ingetrokken`, `afgevallen`.
- Hernoem oude enum waarden via tijdelijke kolom-migratie (Postgres staat geen veilig enum rename met removal toe in één stap).
- Map: `off-market` → `beschikbaar`, `in_onderzoek` → `te_beoordelen`, `nieuw` → `te_beoordelen`. Bestaande `beschikbaar`, `onder_optie`, `verkocht`, `ingetrokken` blijven.

**Nieuw enum `aanbiedingswijze`**: `off_market`, `stille_verkoop`, `openbaar`, `via_makelaar`. Default: `off_market`.

**Nieuwe kolom `objecten.aanbiedingswijze`** (default `off_market`). Bestaande records met oude status `off-market` krijgen `aanbiedingswijze='off_market'`, anderen krijgen default.

**Archiefvelden uitbreiden**
- `objecten`: `archived_note text` toevoegen (is_archived/archived_at/archived_reason bestaan al).
- `deals`: `archived_note text` toevoegen.

**Data cleanup**
- Objecten met status `verkocht` of `ingetrokken` waar `is_archived=false`: zet `is_archived=true`, `archived_at=now()`, `archived_reason` = "Verkocht via Bito Vastgoed" / "Ingetrokken door eigenaar".

## 2. Frontend types & mock-data

`src/data/mock-data.ts`:
- `ObjectStatus` type aanpassen naar nieuwe waarden.
- Nieuwe `Aanbiedingswijze` type.
- Labels en kleur-config bijwerken in `StatusBadges.tsx`.
- `Object` interface: `aanbiedingswijze`, `archivedNote` toevoegen.
- `Deal` interface: `archivedNote` toevoegen.

`useDataStore.tsx`:
- Mappers `mapObject*` aanpassen — geen status⇄fase translatie meer (status is alleen nog basisstatus).
- Filters voor "actief" gebruiken `!isArchived` (niet meer status-list).

## 3. UI: ObjectFormDialog
- Statusdropdown: nieuwe 7 opties met Nederlandse labels.
- Aanbiedingswijze-dropdown toevoegen onder Algemeen.
- Bij wijziging naar `verkocht`/`ingetrokken`/`afgevallen` op submit → archiveer-modal openen vóór save.

## 4. Nieuwe component: ArchiveerDialog
`src/components/ArchiveerDialog.tsx` — generieke modal:
- Props: `open`, `kind: 'object'|'deal'`, `triggerStatus`, `defaultReason`, `onArchiveer`, `onSkip`, `onCancel`.
- Velden: reden-dropdown (lijst per kind), notitie-textarea (verplicht bij "Anders").
- Knoppen: Annuleren / Niet archiveren / Archiveren.

Object-redenen en Deal-redenen zoals in spec.

## 5. ObjectDetailPage
- "Objectfase" hernoemen naar "Trajectfase" in label.
- Trajectfase wijziging naar `afgerond`/`afgevallen` → archiveer-modal.
- Knop "Archiveer object" toevoegen + handmatige flow.
- "Terugzetten naar actief" knop in archief-weergave.

## 6. ObjectenPage
- Tabs Actief/Archief/Alles (zoals DealsPage al heeft).
- Verwijder `off-market` uit filterdropdown, vervang door nieuwe 7 statussen.
- Statuslabels vertalen.

## 7. DealsPage / DealDetailPage
- `DealFormDialog`: bij fase-wijziging naar `afgerond`/`afgevallen` → archiveer-modal.
- Handmatige archiveer-knop op detailpagina.
- Archived_note tonen in archief-tab.

## 8. Bugfix
- Hoofdoorzaak: `actieveObjecten` filter in DashboardPage en pipeline gebruikten status-lijst i.p.v. `!isArchived`. Vervangen door `!isArchived`.
- ObjectPipelineKanban statusdropdown updaten.
- Cache invalidatie verzekeren via `refresh()` na archive-call.

## 9. Bestanden (geschat)

```text
Migratie:
  - supabase/migrations (nieuwe migratie via tool)

Nieuw:
  - src/components/ArchiveerDialog.tsx

Edits:
  - src/data/mock-data.ts
  - src/components/StatusBadges.tsx
  - src/hooks/useDataStore.tsx
  - src/components/forms/ObjectFormDialog.tsx
  - src/components/forms/DealFormDialog.tsx
  - src/pages/ObjectenPage.tsx
  - src/pages/ObjectDetailPage.tsx
  - src/pages/DealDetailPage.tsx
  - src/pages/DealsPage.tsx
  - src/pages/DashboardPage.tsx
  - src/components/pipeline/ObjectPipelineKanban.tsx
  - src/components/pipeline/ObjectPipelineFaseSectie.tsx
```

## Volgorde
1. Migratie + data cleanup (vraagt user-approval)
2. Types + mock-data + badges
3. ArchiveerDialog
4. Forms (Object/Deal)
5. Detailpagina's + lijsten + dashboard fix
6. Build verifiëren

## Open vraag
Geen blokkerende open vragen — spec is volledig. Ga ik door met de migratie?
