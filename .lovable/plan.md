# Plan: Biedingenmodule

## Doel

Eén centrale `biedingen`-tabel om biedingen gestructureerd vast te leggen, vergelijken en opvolgen — gekoppeld aan objecten, relaties/kandidaten en deals. Vervangt losse notitievelden en houdt volledige historie inclusief tegenvoorstellen.

## Datamodel (Supabase migration)

Eén nieuwe tabel `biedingen`, RLS via `is_intern_gebruiker(auth.uid())` zoals andere object-tabellen.

```text
biedingen
  id uuid pk
  object_id uuid                              -- verplicht (alle biedingen horen bij een object)
  relatie_id uuid                             -- verplicht
  deal_id uuid                                -- optioneel
  object_pipeline_id uuid                     -- optioneel (link met kandidaatregel)
  counter_offer_to_id uuid                    -- self-ref, optioneel
  bedrag bigint                               -- in EUR, nullable (concepten/tegenvoorstellen i.v.)
  currency text default 'EUR'
  bieddatum date default current_date
  geldig_tot date
  status biedingstatus                        -- enum, default 'concept'
  offer_type biedingtype                      -- enum, default 'indicatief'
  financieringsvoorbehoud voorbehoud_status   -- enum 'geen'|'ja'|'onbekend'|'nader_te_bepalen'
  dd_voorbehoud voorbehoud_status
  gewenste_levering date
  gewenste_levering_tekst text                -- als datum nog niet bekend
  waarborgsom_bedrag bigint
  waarborgsom_pct numeric
  kosten_type text                            -- 'kk'|'von'|'nader'
  voorwaarden text
  notities text
  interne_notities text
  bron text                                   -- 'kandidaat'|'makelaar'|'koper'|'schriftelijk'|'telefonisch'|'email'|'whatsapp'|'anders'
  is_best_offer boolean default false
  is_final_offer boolean default false
  rejected_reason text
  accepted_at timestamptz
  rejected_at timestamptz
  withdrawn_at timestamptz
  expired_at timestamptz                      -- gezet wanneer geldig_tot voorbij + status update
  aangemaakt_door uuid
  created_at / updated_at
```

Enums:

```text
biedingstatus:   concept | ontvangen | in_behandeling | tegenvoorstel_gedaan |
                 aangepast_bod_gevraagd | geaccepteerd | afgewezen | ingetrokken | verlopen

biedingtype:     indicatief | openingsbod | voorwaardelijk | onvoorwaardelijk |
                 eindbod | tegenvoorstel | verhoogd_bod | schriftelijk | mondeling

voorbehoud_status: geen | ja | onbekend | nader_te_bepalen
```

Index op `object_id`, `relatie_id`, `deal_id`, `status`.

`contact_moments` heeft al `system_key` + `is_system` — gebruiken voor tijdlijnitems (`bieding_toegevoegd`, `bieding_geaccepteerd`, etc.) met FK-loze `object_id`/`relatie_id`/`deal_id` zoals overige integraties.

Geen FK constraints (consistent met bestaande tabellen). Null-safe in alle queries.

## Bestandsstructuur

```text
src/lib/biedingen/
  types.ts              -- TS-types + enum constants + labels
  format.ts             -- helpers: formatBedrag, verschilVraagprijs, isVerlopen
  status.ts             -- status transitions + bevestigingsvragen

src/hooks/
  useBiedingen.tsx      -- list/create/update/delete per object/deal/relatie

src/components/biedingen/
  OfferStatusBadge.tsx
  OfferTypeBadge.tsx
  OfferCard.tsx                 -- mobiel + standalone weergave
  OfferTable.tsx                -- desktop tabel
  OfferComparison.tsx           -- kpi-strip: hoogste / laatste / beste zonder voorbehoud
  OfferActionsMenu.tsx          -- dropdown met alle acties
  OfferFormDialog.tsx           -- create/edit modal
  OfferAcceptDialog.tsx         -- bevestiging + optioneel andere afwijzen
  OfferRejectDialog.tsx         -- reden invullen
  OfferCounterDialog.tsx        -- tegenvoorstel-shortcut
  OffersSection.tsx             -- volledige sectie: comparison + table/cards + add knop
  OffersForCandidate.tsx        -- biedingsgeschiedenis per kandidaat (chronologisch)
```

## Integratie in bestaande schermen

- **ObjectDetailPage**: nieuwe sectie "Biedingen" toegevoegd aan SectionNav, geplaatst direct na/naast Kandidaten/Pipeline.
- **DealDetailPage**: nieuwe sectie "Biedingen" (filtert op `deal_id`).
- **ObjectPipelineSectie / KandidatenKanban**: per kandidaatregel knop "+ Bod" die `OfferFormDialog` opent met `object_id`, `relatie_id` en `object_pipeline_id` voorgevuld. Toont compact laatste bod + badge bij kandidaat.

## Acties & side-effects

- **Toevoegen** → tijdlijnitem `bieding_toegevoegd` op object+relatie+deal, optioneel vervolgtaak via bestaande `TaakFormDialog`.
- **Wijzigen** → tijdlijnitem `bieding_gewijzigd`.
- **Tegenvoorstel** → nieuwe bieding met `counter_offer_to_id` + `offer_type='tegenvoorstel'`, status default `tegenvoorstel_gedaan`. Vorige bieding krijgt status `tegenvoorstel_gedaan` indien nog open.
- **Accepteren** → bevestigingsdialog, `accepted_at` zetten, vraagt of andere open biedingen op zelfde object als afgewezen moeten worden gemarkeerd (default uit). Toont info dat dealfase handmatig bij te werken is.
- **Afwijzen** → reden verplicht, `rejected_at`+`rejected_reason`.
- **Intrekken** → `withdrawn_at`.
- **Verlopen detectie** → client-side: als `geldig_tot < today` en status nog open → toon "Verlopen" badge. Geen automatische DB-update.

## Vergelijking (OfferComparison)

KPI-strip bovenaan:
- Aantal open biedingen
- Hoogste bod (+ verschil met `objecten.prijsindicatie` waar parsebaar of `vraagprijs`)
- Laatste bod
- Beste bod zonder voorbehouden (financiering=geen en dd=geen)
- Eerstvolgende vervaldatum

Verschil met vraagprijs: parseer `objecten.prijsindicatie` (string) via bestaande logica indien aanwezig; anders "Vraagprijs onbekend".

## Responsiveness

- Desktop (`md+`): `OfferTable` met sorteerbare kolommen.
- Mobiel: `OfferCard` lijst, full-width, geen horizontale scroll, acties in `DropdownMenu`.
- `OfferFormDialog` gebruikt bestaande shadcn Dialog met 5 collapsible secties: Koppeling / Bod / Voorwaarden / Opvolging / Notities.

## Out of scope (v1)

- Dashboard-widgets (datamodel ondersteunt het, UI volgt later).
- Automatische dealfase-transities bij accepteren (alleen suggestie tonen).
- E-mailnotificaties bij verlopen biedingen.
- Bulk-acties over meerdere biedingen.

## Acceptatie

Alle 17 punten uit het verzoek; build schoon; null-safe; geen horizontale scroll mobiel; tijdlijn-integratie werkt; tegenvoorstel-keten zichtbaar per kandidaat.
