## Doel

Een nieuwe sectie **"Dossier & aanbieding"** op de Objectdetailpagina, waarmee je per off-market object overzicht houdt over informatiepositie, klaar-staande teksten, interne aandachtspunten en verkoopgereedheid — zonder ergens te blokkeren als data ontbreekt.

## Scope (V1)

Eén nieuwe tab/sectie op `ObjectDetailPage`, met 5 subtabs:

1. **Checklist** — items per categorie met 6 statussen
2. **Aanbiedingsteksten** — opgeslagen marketingteksten met kopieerknop
3. **Aandachtspunten** — interne risico's/openstaande punten
4. **Documenten** — bestaande `DocumentenPanel` hergebruiken (read-only link)
5. **Verkoopgereedheid** — samenvatting + dossierscore bovenaan altijd zichtbaar

## Datamodel (Supabase migrations)

Drie nieuwe tabellen, allemaal met dezelfde RLS als andere object-gebonden tabellen (`is_intern_gebruiker(auth.uid())` voor SELECT/INSERT/UPDATE/DELETE).

```text
object_dossier_items
  id uuid pk
  object_id uuid                          -- geen FK; consistent met bestaande tabellen
  category text                           -- 'basis' | 'financieel' | 'juridisch' | 'technisch' | 'commercieel'
  item_key text                           -- stabiele key (bv 'huurlijst', 'energielabel')
  label text                              -- weergavetekst (default uit catalogus, overschrijfbaar)
  status text                             -- 'aanwezig'|'opgevraagd'|'ontbreekt'|'niet_beschikbaar'|'nvt'|'te_controleren'|null
  notitie text
  bron text
  opgevraagd_op date
  document_id uuid                        -- optionele koppeling object_documenten.id
  weight smallint default 1               -- 1=normaal, 2=belangrijk, 3=cruciaal
  is_custom boolean default false         -- door user toegevoegd item
  created_at / updated_at
  unique(object_id, item_key)

object_aanbiedingsteksten              -- 1 rij per object
  id uuid pk
  object_id uuid unique
  korte_teaser text
  whatsapp_tekst text
  email_tekst text
  uitgebreide_omschrijving text
  highlights text
  externe_aandachtspunten text
  fee_tekst text
  nda_tekst text
  created_at / updated_at

object_aandachtspunten
  id uuid pk
  object_id uuid
  titel text not null
  type text                              -- 'juridisch'|'technisch'|'financieel'|'commercieel'|'info_ontbreekt'|'overig'
  ernst text                             -- 'laag'|'middel'|'hoog'
  intern_only boolean default true
  notitie text
  status text default 'open'             -- 'open'|'opgevolgd'|'opgelost'|'niet_oplosbaar'
  created_at / updated_at
```

Bestaande velden op `objecten` worden niet gewijzigd. Checklist-items worden lazy aangemaakt: als er nog geen rij bestaat voor een `item_key`, behandelen we hem als status `null` (= "nog niet ingevuld").

## Checklist-catalogus

Hardcoded TS-bestand `src/lib/objectDossier/catalog.ts` met alle items uit categorieën A–E uit het verzoek, per item: `key`, `label`, `category`, `weight`, optioneel `autoFromObjectField` (bv. `energielabel`, `bouwjaar`, `vraagprijs`) om automatisch status `aanwezig` te tonen als het objectveld al gevuld is. Gebruiker kan dat overschrijven door expliciet een rij op te slaan.

## Verkoopgereedheid-score

Logica in `src/lib/objectDossier/readiness.ts`:

- Score = gewogen percentage van items met status `aanwezig` of `nvt` t.o.v. relevante items (alles behalve `nvt`).
- `opgevraagd` en `te_controleren` tellen voor 50%.
- `ontbreekt` / `niet_beschikbaar` / leeg tellen voor 0%.
- Cruciale items (`weight=3`) die ontbreken worden apart getoond als "Belangrijkste ontbrekende punten".

Label-mapping op basis van score + aanwezigheid cruciale items:

```text
< 20%                                  → Niet gereed
20–40%                                 → Summier dossier
40–60% en korte_teaser aanwezig        → Teaser-gereed
60–80%                                 → Informatiepakket gedeeltelijk
≥ 80%                                  → Verkoopklaar
≥ 90% en alle juridische cruciaal ok   → DD-gereed
```

## Componenten

```text
src/components/object/dossier/
  ObjectDossierCard.tsx          -- wrapper + readiness header + tabs
  DossierReadinessBadge.tsx      -- gekleurd label + percentage
  DossierChecklist.tsx           -- accordion per categorie
  DossierChecklistItem.tsx       -- status-select, notitie, datum, bron, doc, acties
  OfferingTextsSection.tsx       -- form met textareas + kopieerknop per veld
  AttentionPointsSection.tsx     -- lijst + add/edit dialog
```

Hergebruikt: `Accordion`, `Tabs`, `Textarea`, `Input`, `Badge`, `Button`, `Card`, `toast` (sonner).

## Acties

- Per checklist-item dropdown "Acties": **Taak aanmaken** (opent bestaande `TaakFormDialog` met preset object/titel), **Contactmoment loggen** (`ContactMomentFormDialog`), **Document koppelen** (selectie uit `object_documenten`).
- Per tekstveld: **Kopieer** (clipboard + toast).
- Bovenin sectie: knop **Markeer als teaser-gereed** / **verkoopklaar** → zet de juiste commerciële checklist-items op `aanwezig`.

## Integratie in `ObjectDetailPage.tsx`

Eén nieuw tabblad / sectie "Dossier & aanbieding" toegevoegd vóór bestaande Vastgoedrekenen-tab. Geen wijziging aan andere tabs. Lazy data-fetch via nieuwe hook `useObjectDossier(objectId)` die de drie tabellen ophaalt; alles null-safe zodat oude objecten zonder rijen probleemloos renderen.

## Null-safety & non-blocking

- Geen NOT NULL constraints op status/notes.
- Geen verplichte invoer in UI.
- Als migrations niet hebben gedraaid: hook vangt errors en toont lege staat.
- Bestaande objecten zonder enige dossierrij tonen "Nog niets ingevuld" + score 0% (Niet gereed), zonder crash.

## Out of scope (V1)

- PDF-export van dossier
- Automatische teaser-generatie via AI
- Externe deel-link / publieke teaserpagina
- Bulk-acties over meerdere objecten
- Notificaties voor opgevraagde-maar-niet-binnen info

## Acceptatie

Alle 12 acceptatiecriteria uit het verzoek; build draait schoon; mobiel = accordion, desktop = tabs + cards.

---

Akkoord met dit plan? Dan begin ik met de migration en daarna de componenten.
