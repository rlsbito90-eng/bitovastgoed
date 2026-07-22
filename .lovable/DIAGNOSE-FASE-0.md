# FASE 0 — Baseline en impactanalyse Acquisitieselectie

Read-only diagnose. Peildatum: 2026-07-22. Bron: productieproject.
Geen code- of datawijzigingen uitgevoerd.

## 1. Baseline volume

| Metriek | Waarde |
|---|---|
| Items in `off_market_acquisitie_selectie` (actief, niet gearchiveerd) | **42** |
| Items totaal (incl. gearchiveerd) | 53 |
| Oudste `toegevoegd_op` | 2026-06-23 |
| Nieuwste `toegevoegd_op` | 2026-07-21 |
| Actieve brieven bij deze selectie | 59 |
| Geadresseerden per signaal | 0: 2 · 1: 29 · 2: 9 · 3: 1 · 4: 1 |

De 2 signalen zonder brieven hebben status `archief` / `afgevallen`. Beide vallen in werkbak **Afgehandeld** in het voorstel.

## 2. Huidige signaalstatussen in de selectie

| status | aantal |
|---|---|
| benaderen | 16 |
| benaderd | 13 |
| eigenaar_gevonden | 5 |
| interessant | 3 |
| eigenaar_achterhalen | 2 |
| object_ontvangen | 1 |
| archief | 1 |
| afgevallen | 1 |

## 3. Brieven per kanaal, status en verzendstatus

| kanaal | status | verzendstatus | aantal |
|---|---|---|---|
| email | concept | concept | 1 |
| email | verstuurd | verzonden | 2 |
| post | concept | concept | 1 |
| post | concept | geprint | 36 |
| post | verstuurd | gepost | 19 |

- Datumdekking (59 actieve brieven): `printdatum` 54, `postdatum` 21, `verzonden_op` 21, `opvolgdatum` 21, `responsdatum` 1, `created_at` 59.
- 20 van 21 verzonden brieven hebben een `opvolgdatum` in het verleden (dus opvolging is technisch verlopen), 1 heeft toekomstige opvolgdatum.
- Responsstatus: 58× null, 1× `wil_meer_informatie`.

## 4. Brief-events

40 signalen hebben ten minste één event. In totaal 201 events verspreid over: `printed` 72 · `concept_created` 62 · `posted` 32 · `follow_up_created` 25 · `sent` 6 · `pdf_generated` 3 · `response_received` 1. Voldoende dekking om Fase 4 (procesdatums op de rij) op te bouwen.

## 5. Fase-verdeling: huidig vs. voorstel (zwakste-schakel)

| Fase | Huidig (`some`) | Voorstel (`weakest link`) |
|---|---:|---:|
| afgerond | 3 | 3 |
| geprint | 26 | 26 |
| opvolging_open | 12 | 12 |
| gepost | 1 | — |
| wachten | — | 1 |
| **Totaal** | **42** | **42** |

## 6. Overgangsmatrix

| huidig → voorstel | aantal |
|---|---:|
| afgerond → afgerond | 3 |
| geprint → geprint | 26 |
| opvolging_open → opvolging_open | 12 |
| gepost → wachten | **1** |

**Slechts 1 signaal (2,4 %) wisselt van fase** wanneer de zwakste-schakel-regel actief wordt. Dat signaal heeft één gepost stuk met toekomstige opvolgdatum; onder de huidige `some`-logica staat het in `gepost`, onder het voorstel in `wachten` (correct — er is niets actiefs te doen).

## 7. Voorgestelde werkbak-verdeling

| Werkbak | Aantal |
|---|---:|
| Actie/Onderzoeken | 0 |
| Actie/Brief voorbereiden | 0 |
| Actie/Printen & posten | 26 |
| Actie/Opvolgen (Plan) | 0 |
| Actie/Opvolgen (Vandaag/Verlopen) | 12 |
| Wachten | 1 |
| Afgehandeld | 3 |
| **Totaal** | **42** |

Onder Actie in totaal: **38 items (90 %)**. De rest zit in Wachten (1) of Afgehandeld (3).

## 8. Impactconclusies

- **Zwakste-schakelregel is veilig.** 41 van 42 signalen (97,6 %) houden dezelfde fase. Geen signaal springt onverwacht een fase terug.
- **Geen signalen verdwijnen uit beeld.** De 42 actieve items zijn allemaal 1-op-1 mapbaar op een werkbak. Er is geen restcategorie nodig.
- **Werkbak-zwaartepunten:** 26× Printen & posten en 12× Opvolgen (Verlopen). Dit sluit aan bij het huidige gebruikspatroon.
- **Onderzoek/Brief voorbereiden zijn nu leeg.** Beide werkbakken zijn wel nodig voor toekomstige instroom (nieuwe signalen die net in de selectie komen).
- **Adresvolledigheid is geen probleem meer** (na de eerdere buitenland-fix). Er zijn geen actieve items zonder werkbaar adres.
- **Datumbron voor procesdatums** kan komen uit: `printdatum`, `postdatum`, `verzonden_op`, `opvolgdatum`, `responsdatum` (afgeleid van brieven) en `off_market_brief_events` als fallback voor `posted`/`sent`/`printed`.

## 9. Openstaande aandachtspunten voor Fase 1 (buckets & default-sort)

1. **Definitie “eerstvolgende actie-datum” per werkbak** (voor default-sort “Werkvolgorde”). Voorstel:
   - Printen & posten → `printdatum` (`min`), fallback `updated_at` van de brief.
   - Opvolgen (Vandaag/Verlopen) → `opvolgdatum` (`min`, dringendste eerst).
   - Onderzoeken / Brief voorbereiden → `toegevoegd_op` (`asc`, oudste openstaand eerst).
   - Wachten → `opvolgdatum` (`min`, dichtstbij eerst).
   - Afgehandeld → `responsdatum` / laatste event datum (`desc`).

2. **Sub-chip-teller mag alleen tellen op basis van `zichtbare` werkbak** (voorkomt dat sub-chips onder Wachten leegblijven maar wel getoond worden).

3. **Alleen data die per rij logisch is** wordt getoond; geen `updated_at` op de rij.

## 10. Wat is NIET gedaan

- Geen wijziging in code, UI, database, RLS of migraties.
- Geen aanpassing in `readiness.ts`, `useAcquisitieSelectie.tsx` of `AcquisitieSelectieTab.tsx`.
- Geen wijziging aan sort-volgorde of filters die live zijn.

Klaar voor review vóór Fase 1.
