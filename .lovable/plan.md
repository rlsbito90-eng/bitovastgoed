## Module: Acquisitie

Nieuwe hoofdmodule voor off-market acquisitie vóór een pand Object/Deal wordt. Twee onderdelen: **Targets** en **Campagnes**, plus een Dashboard-widget.

---

### 1. Database (veilige migratie, additief)

Twee nieuwe tabellen + twee enums. Geen wijzigingen aan bestaande tabellen, behalve één **nullable** kolom op `objecten` om herkomst vanuit een target te tracken.

**Enums**
- `acquisitie_status`: `target_gevonden`, `eigenaar_achterhalen`, `eerste_benadering`, `follow_up_gepland`, `reactie_ontvangen`, `verkoopbereidheid_peilen`, `potentiele_verkooppositie`, `object_aangemaakt`, `niet_interessant`
- `campagne_kanaal`: `brief`, `bellen`, `linkedin`, `email`, `netwerk`, `anders`
- `campagne_status`: `concept`, `actief`, `gepauzeerd`, `afgerond`

**Tabel `acquisitie_campagnes`**
- naam, kanaal, gebied, startdatum, status, notities, created_at, updated_at, aangemaakt_door
- RLS: intern lezen/schrijven (zelfde patroon als bestaande tabellen)

**Tabel `acquisitie_targets`**
- adres, postcode, plaats, wijk, type_vastgoed (text), reden_interessant, bron, campagne_id (nullable FK), eigenaar_bekend (`ja|nee|onbekend`), eigenaar_woont_op_adres (`ja|nee|onbekend`), relatie_id (nullable), status (acquisitie_status), prioriteit (smallint 1-5), laatste_actie_datum, volgende_actie_datum, volgende_actie_omschrijving, notities, object_id (nullable, gezet bij conversie), created_at, updated_at, aangemaakt_door
- RLS: intern lezen/schrijven

**Bestaand `objecten`**: kolom `acquisitie_target_id uuid NULL` toevoegen (puur voor traceerbaarheid; nullable, geen FK om migratie veilig te houden).

---

### 2. Frontend

**Nieuwe routes** (`src/App.tsx`):
- `/acquisitie` → AcquisitiePage (Tabs: Targets | Campagnes)
- `/acquisitie/targets/:id` → TargetDetailPage
- `/acquisitie/campagnes/:id` → CampagneDetailPage

**Navigatie** (`src/components/AppLayout.tsx`):
- Item "Acquisitie" met `Target` icon, gepositioneerd tussen Pipeline en Taken.

**Pages**
- `AcquisitiePage.tsx` — Tabs Targets/Campagnes met respectievelijke lijsten + "Nieuw" knoppen
- Targets-lijst: filters op status, plaats, campagne, prioriteit, type vastgoed; kolommen incl. `GeenActieBadge` (zonder volgende actie / verlopen)
- Campagnes-lijst: kolommen naam/kanaal/status/#targets/#reacties/#warme leads/#objecten

**Dialogs**
- `AcquisitieTargetFormDialog.tsx` — alle velden, koppel aan relatie + campagne
- `AcquisitieCampagneFormDialog.tsx` — campagne CRUD
- Auto-close op succes (huidige projectstandaard)

**Detail pages**
- `TargetDetailPage`: alle velden, knop **"Maak Object"** → opent `ObjectFormDialog` met prefill (adres/postcode/plaats/type), na succes `acquisitie_target_id` zetten op het nieuwe object en target-status → `object_aangemaakt`. Knop **"Koppel relatie"** via bestaande relatie-select.
- `CampagneDetailPage`: campagne-info + lijst van gekoppelde targets + conversiestatistieken (afgeleid uit targets).

**Shared**
- Hergebruik `GeenActieBadge` voor zonder/verlopen volgende actie.
- Hergebruik bestaand status-chip-patroon (`StatusBadges`-stijl) met nieuw `AcquisitieStatusBadge`.

**Data store**
- Nieuwe hook `useAcquisitie.tsx` (apart, raakt `useDataStore` niet) met: list/create/update/delete voor targets en campagnes, plus `convertTargetNaarObject(targetId)`.

---

### 3. Dashboard widget

In `src/pages/DashboardPage.tsx` een compacte sectie "Acquisitie" onderaan met:
- # actieve targets (status ≠ `object_aangemaakt`/`niet_interessant`)
- # targets zonder volgende actie
- # verlopen acquisitie-acties (volgende_actie_datum < vandaag)
- # reacties deze maand (status `reactie_ontvangen`, updated_at in maand)
- # warme leads (status in `verkoopbereidheid_peilen`/`potentiele_verkooppositie`)
- # objecten aangemaakt vanuit acquisitie (status `object_aangemaakt`)
- Beste campagne (meeste reacties)

Geen wijzigingen aan bestaande KPI-logica.

---

### Niet inbegrepen

Geen kaart-UI, geen Kadaster/BAG/externe integraties, geen wijzigingen aan bestaande modules behalve de single nullable kolom op `objecten` en het toegevoegde nav-item + dashboardwidget.

---

### Volgorde van uitvoer

1. Migratie indienen ter goedkeuring (enums, twee tabellen, RLS, kolom op `objecten`).
2. Na approval: hook + dialogs + pages + nav + dashboardwidget + route.
