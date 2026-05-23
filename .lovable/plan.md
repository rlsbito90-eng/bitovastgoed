
## Scope

Dit is een grote, app-brede UX/UI-update van invoer-/bewerkmodals plus enkele functionele aanvullingen (auto-rekenen financieel, conditionele potentievelden, WOZ-jaarinput). Onderstaand plan bundelt alle 10 onderdelen tot één coherente uitvoering.

## Aanpak per onderdeel

### 1. Geen horizontale overflow op mobiel
- `DialogContent` van zware modals krijgt `overflow-x-hidden` en `max-w-[100vw]` op mobiel.
- Grids `sm:grid-cols-2`/`md:grid-cols-3` blijven 1-koloms onder `sm`.
- Inputs en select-triggers krijgen `w-full min-w-0`.
- Brede helperteksten/badges krijgen `break-words`.

### 2. Modal-tabs in app-design (Liquid Glass selected state)
- Maak een herbruikbare class `modal-tab-pill` in `index.css` (analoog aan `dossier-tab-pill`): glass-fill, gold ring/border op `data-[state=active]`, muted inactive, focus ring.
- Pas `TabsList` aan naar `glass-card rounded-full bg-transparent p-1 gap-1` met horizontaal scrollen (`overflow-x-auto no-scrollbar`) en active tab `scrollIntoView({inline:'center'})`.
- Toepassen op: `ObjectFormDialog`, `RelatieFormDialog`, `DealFormDialog`, `ZoekprofielFormDialog`, `ReferentieObjectFormDialog`, `AcquisitieCampagneFormDialog`, `AcquisitieTargetFormDialog`.

### 3. Tabwissel → naar boven
- Voeg ref op de scroll-container toe; bij `onValueChange` zet `scrollTop = 0`.
- Eenvoudige hook `useResetScrollOnTabChange(tab, ref)` zodat we het in alle modals consistent kunnen toepassen.

### 4. Financiële auto-berekeningen (ObjectFormDialog)
Nieuwe utility `src/lib/financialCalc.ts`:
- `derive({maandhuur, jaarhuur, m2, vraagprijs, noi}, lastEdited)` → afgeleide velden.
Regels:
- Maandhuur ↔ jaarhuur: bron is `lastEdited`; ander veld wordt afgeleid.
- Huur per m² = jaarhuur / m² (oppervlakte GBO of VVO als fallback).
- BAR = jaarhuur / vraagprijs × 100.
- NAR = NOI / vraagprijs × 100.
- Kapitalisatiefactor = vraagprijs / jaarhuur (weergave `13.8x`).
- NOI: nooit overschrijven als gebruiker handmatig invulde — toon "auto-berekend" indicator alleen als waarde leeg is.
- Raw input state per veld (string), parse op blur. Voorkomt cursor-jumps en sta lege string toe.
- Save direct dirty bij eerste wijziging.
- Toon kleine `auto` chip naast afgeleide velden.

### 5. WOZ-peildatum jaar-input
- Vervang datepicker door `Input type="number"` (jaar) of compacte jaar-select 2010–huidig+1.
- Opslag: `01-01-YYYY` ISO string. Bestaande full-date waarden worden gelezen via `new Date(...).getFullYear()` als fallback.

### 6. App-brede clear/empty
- Alle nummer-inputs gebruiken `value={x ?? ''}` en `onChange` zet `undefined` bij lege string (utility `setNumOrEmpty`).
- Select-velden: voeg `"—"` (leeg) optie toe waar relevant via `<SelectItem value="__none__">`; mapping naar `undefined`.
- Verifieer dat backspace tot leeg → save dirty + persist als `null`.
- Audit op alle formulieren met grep `value=\{[a-z]*\.[a-zA-Z]+ \?\? ['"]`.

### 7. Standaard "Ook bruikbaar als referentieobject" aan
- `leegForm` markeer state: `markeerAlsReferentie` initialiseren op `true` bij nieuw object, `false` bij edit (of huidige logica respecteren).

### 8. Potentievelden conditioneel (Pand-tab)
- Nieuwe DB-kolommen op `objecten`:
  - `potentie_omschrijving text`
  - `potentie_strategie text` (enum-string)
  - `potentie_extra_m2 numeric`
  - `potentie_extra_units integer`
  - `potentie_onderbouwing_status text`
  - `potentie_afhankelijkheden text`
  - `potentie_bron text`
- UI: blok zichtbaar als `ontwikkelPotentie || transformatiePotentie`.
- Mapping toevoegen in datastore + types.

### 9. App-brede consistentie
- Tabs/scroll/overflow/clear-utilities toepassen op alle bovengenoemde modals + waar relevant `ContactMomentFormDialog`, `TaakFormDialog`, `OfferFormDialog`, `PipelineKandidaatDialog`, scenario-inputs in Vastgoedrekenen.

### 10. QA
- `tsc` schoon, build schoon, light + dark visueel checken (393×697 viewport en desktop).

## Technische details

```text
src/
├── index.css                            # + .modal-tab-pill, .modal-tabs-list
├── lib/
│   ├── financialCalc.ts                 # NEW: derive(...) helpers
│   └── formHelpers.ts                   # NEW: setNumOrEmpty, NONE_VALUE
├── hooks/
│   └── useResetScrollOnTabChange.ts     # NEW
├── components/forms/
│   ├── ObjectFormDialog.tsx             # tabs, overflow, financieel, woz, potentie, ref-toggle default
│   ├── RelatieFormDialog.tsx            # tabs, overflow, clear
│   ├── DealFormDialog.tsx               # tabs, overflow, clear
│   ├── ZoekprofielFormDialog.tsx        # tabs, overflow, clear
│   ├── ReferentieObjectFormDialog.tsx   # tabs, overflow, clear, woz
│   ├── AcquisitieCampagneFormDialog.tsx # tabs/overflow
│   ├── AcquisitieTargetFormDialog.tsx   # tabs/overflow
│   ├── ContactMomentFormDialog.tsx      # overflow, clear
│   ├── TaakFormDialog.tsx               # overflow, clear
│   └── ...
└── components/biedingen/OfferFormDialog.tsx
supabase/migrations/<ts>_object_potentie_velden.sql
```

Migration:
```sql
ALTER TABLE public.objecten
  ADD COLUMN potentie_omschrijving text,
  ADD COLUMN potentie_strategie text,
  ADD COLUMN potentie_extra_m2 numeric,
  ADD COLUMN potentie_extra_units integer,
  ADD COLUMN potentie_onderbouwing_status text,
  ADD COLUMN potentie_afhankelijkheden text,
  ADD COLUMN potentie_bron text;
```

## Risico's
- App-breed touchen van veel formulieren kan regressies introduceren in opslag-mapping. Mitigatie: alleen layout/value-handling aanpassen; geen submit-paths refactoren.
- Auto-rekenen voor NOI moet handmatige invoer respecteren — strikte `lastEdited`-tracking.
- Schema-change vereist user-approval (migration tool).

## Volgorde van uitvoering
1. Index.css tab-pill + scroll hook + util libs.
2. ObjectFormDialog (zwaarste): overflow, tabs, scroll, financieel, woz, potentie, ref-toggle.
3. DB-migratie voor potentievelden (na user approval).
4. Overige modals: tabs/overflow/clear toepassen.
5. QA pass mobiel + desktop, light + dark.

Geef akkoord, dan voer ik het in deze volgorde uit.
