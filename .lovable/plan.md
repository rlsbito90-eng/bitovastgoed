# Plan — Contactmomenten / Tijdlijn module

Een centrale tijdlijn waarmee je per Relatie, Object, Deal en Acquisitietarget snel de geschiedenis ziet: gesprekken, statuswijzigingen, taken, biedingen, archivering, kandidaten. Handmatig loggen én automatisch loggen door de app.

Gegeven de omvang stel ik een gefaseerde aanpak voor. **Fase 1 + 2** levert de werkende module (handmatig + autolog van belangrijkste acties + tijdlijn op detailpagina's). **Fase 3** voegt verfijningen toe (lijst-kolommen, dashboardsignalen). Standaard ga ik door Fase 1 én 2 uitvoeren in deze ronde.

---

## Fase 1 — Datalaag & basis

### 1.1 Database

Nieuwe tabel `contact_moments`:

```text
id              uuid pk
created_at      timestamptz
updated_at      timestamptz
moment_date     date          (verplicht)
moment_time     time          (optioneel)
type            enum          (zie hieronder)
title           text          (verplicht, kort)
description     text          (optioneel)
direction       enum          (inkomend | uitgaand | intern | n_v_t)
outcome         text          (optioneel)
follow_up_required  boolean   default false
follow_up_date  date          (optioneel)
relatie_id      uuid          (optioneel, fk → relaties)
object_id       uuid          (optioneel, fk → objecten)
deal_id         uuid          (optioneel, fk → deals)
acquisitie_target_id uuid     (optioneel, fk → acquisitie_targets)
taak_id         uuid          (optioneel)
is_system       boolean       default false   (door auto-log gemaakt)
system_key      text          (optioneel, dedupe-sleutel voor auto-logs)
aangemaakt_door uuid          (optioneel)
```

Enums:
- `contact_moment_type`: telefoon, email, whatsapp, linkedin, afspraak, bezichtiging, notitie, document_gedeeld, teaser_verstuurd, nda_verstuurd, nda_ontvangen, informatie_gedeeld, bod_ontvangen, bod_uitgebracht, status_gewijzigd, taak_aangemaakt, taak_afgerond, kandidaat_toegevoegd, archief, algemeen
- `contact_moment_direction`: inkomend, uitgaand, intern, n_v_t

Indexen op `relatie_id`, `object_id`, `deal_id`, `acquisitie_target_id`, `moment_date desc`. Unique-index op `(system_key)` waar niet null, zodat auto-logs niet dubbel ontstaan.

RLS: zelfde patroon als bestaande tabellen — `is_intern_gebruiker(auth.uid())` voor SELECT/INSERT/UPDATE/DELETE. Systeemitems mogen interne gebruikers wél verwijderen, maar UI zal dit afschermen.

### 1.2 Datastore-integratie

Uitbreiding `useDataStore`:
- `contactMoments` lijst + `refresh`
- `getContactMomentsFor({ relatieId?, objectId?, dealId?, acquisitieTargetId? })`
- `addContactMoment(input)` — handmatig
- `updateContactMoment(id, patch)`
- `deleteContactMoment(id)`
- `logSystemMoment({ type, title, ..., systemKey })` — interne helper, dedupe op `systemKey`

### 1.3 Helpers
- `src/lib/contactMoments.ts`: label-map types, icon-map (Lucide), kleur-map, format helpers.

---

## Fase 2 — UI & autolog

### 2.1 Herbruikbare componenten

- `Timeline` — verticale tijdlijn met datumgroepering, filterbalk (Alle / Contact / Notities / Systeem / Taken), zoekveld.
- `TimelineItem` — datum/tijd, type-badge + icoon, titel, omschrijving, gekoppelde entiteiten als subtiele chips, vervolgactie-regel, edit/delete acties (alleen op niet-systeem).
- `ContactMomentFormDialog` — modal met velden uit specificatie. Hergebruikt `EntityPicker` voor Relatie/Object/Deal/Acquisitie. Auto-koppelt op basis van context. Optie "Vervolgtaak aanmaken" toont inline taakvelden (titel, deadline, tijd, type, prioriteit) en maakt na opslaan een `Taak` via bestaande store, gekoppeld aan dezelfde entiteiten.
- `LogActionDropdown` — `+ Log` knop met preset types (telefoon, email, whatsapp, linkedin, notitie, …) die de modal openen met type voorgeselecteerd.

### 2.2 Detailpagina-integratie

Op `RelatieDetailPage`, `ObjectDetailPage`, `DealDetailPage` en `AcquisitieTargetDetailPage`:
- Sectie "Tijdlijn" onder bestaande inhoud, met `LogActionDropdown` rechtsboven.
- Auto-context: huidige entiteit-id wordt voorgevuld en vergrendeld (wel ontkoppelbaar).

### 2.3 Automatisch loggen

Wrap in `useDataStore` rond bestaande mutaties (geen schema-wijziging aan andere tabellen). Elke autolog gebruikt een `systemKey` als dedupe.

Logs voor:
- Taak aangemaakt / afgerond (`taak:{id}:created|done`)
- Object status gewijzigd (`object:{id}:status:{from}->{to}:{ts}`)
- Object gearchiveerd / hersteld
- Deal fase gewijzigd
- Deal gearchiveerd / hersteld
- Kandidaat toegevoegd aan deal (`deal:{id}:kandidaat:{relId}:added`)
- Pipeline-fase wijziging (object_pipeline)
- Bieding toegevoegd/gewijzigd (deal indicatief_bod, object_pipeline bieding_bedrag)
- Acquisitie-target status gewijzigd

Bij taak-afronden: subtiele toast met "Uitkomst loggen?" → opent modal met type-keuze (Geen gehoor / Gesproken / WhatsApp / Mail / Anders).

### 2.4 Bestaande notities

Niet migreren. Bestaande `notities`-velden blijven werken. Nieuwe notitie-contactmomenten zijn een tweede, complementair kanaal — duidelijk gemarkeerd in tijdlijn.

---

## Fase 3 — Lijst- en dashboard-signalen (later, niet in deze ronde)

- Kolom "Laatste contact" + "Volgende actie" op Relaties-, Objecten-, Dealslijst.
- Dashboard-widget: warme leads zonder recent contact, deals zonder contact in X dagen.

---

## Acceptatie (Fase 1+2 deliverable)

- Tabel + RLS + types live.
- Tijdlijn zichtbaar op Relatie/Object/Deal/Acquisitie-detail, nieuwste bovenaan, filterbaar.
- Handmatig contactmoment toevoegen, auto-koppeling vanuit context, multi-koppelingen mogelijk.
- Optionele vervolgtaak vanuit modal.
- Autolog voor taken, status/fase, archivering, kandidaten, biedingen, pipeline.
- Bewerken/verwijderen alleen voor handmatige items; systeemitems read-only.
- Mobiel en desktop netjes; TypeScript schoon.

---

Mag ik doorgaan met Fase 1 + 2?
