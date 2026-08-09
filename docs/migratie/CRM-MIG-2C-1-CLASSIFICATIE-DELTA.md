# CRM-MIG-2C-1 — read-only classificatiedelta

Status: migratievoorbereiding. Geen DDL/DML/deploy.

## Doel

Exact vastleggen wat op `vyjocdlwfxrblusfngfq` ontbreekt voor cluster 2B-1 (property/deal-classificatie), inclusief de drie bestaande tabellen die door de bronmigraties worden geraakt.

## Broncontract

Relevante historische migraties:

- `20260427140858_fd240c17-724e-4d95-b671-6e1ce3c6656c.sql`;
- `20260427141800_9a9277fb-d354-4449-b307-117dc1f2ffa5.sql`.

De tweede migratie voegt specifiek `relaties.deal_type_ids` toe en hoort daarom bij hetzelfde classificatiecluster.

## Huidig doelbeeld — bewezen read-only

De vier canonieke classificatietabellen ontbreken volledig op `vyjoc...`:

- `property_types`;
- `property_subtypes`;
- `deal_types`;
- `property_type_aliases`.

Ook de negen actuele koppelingkolommen ontbreken op de bestaande tabellen:

- `objecten.property_type_id`;
- `objecten.property_subtype_ids`;
- `objecten.deal_type_ids`;
- `zoekprofielen.property_type_ids`;
- `zoekprofielen.property_subtype_ids_v2`;
- `zoekprofielen.deal_type_ids`;
- `relaties.property_type_ids`;
- `relaties.property_subtype_ids`;
- `relaties.deal_type_ids`.

De bijbehorende classificatie-indexen zijn daarmee eveneens nog niet aanwezig.

## Dependencies die al aanwezig zijn

De policies uit de bronmigratie kunnen conceptueel op het huidige doel aansluiten, omdat reeds aanwezig zijn:

- enum `app_role` met labels `admin` en `medewerker`;
- `has_role(_user_id uuid, _role app_role) -> boolean`;
- `is_intern_gebruiker(_user_id uuid) -> boolean`.

Dit is nog geen toestemming om policies of tabellen te installeren; het bewijst alleen dat deze specifieke afhankelijkheden niet opnieuw opgebouwd hoeven te worden.

## Canonieke tabelvorm uit de bron

De vier nieuwe tabellen bevatten UUID-primary keys, slugs/namen/sortering/actiefstatus, foreign keys van subtypes/aliases naar property-types/subtypes, uniqueness op relevante slugs/aliases, RLS en gerichte authenticated/admin-policies. De historische migratie bevat daarnaast seeddata voor de property/deal-taxonomie.

Seeddata moet vóór een DDL-BUILD apart als inhoudelijk contract worden gevalideerd. Historische INSERT-statements mogen niet automatisch worden beschouwd als migratieopdracht.

## Besluit

Een toekomstige uitvoerbare `CRM-MIG-2C-2` mag niet de historische migraties blind replayen. Die BUILD moet een nieuwe, doelgerichte en idempotente delta bevatten voor uitsluitend:

1. de vier classificatietabellen;
2. hun PK/FK/unique/index/RLS/policies;
3. de negen koppelingkolommen op `objecten`, `zoekprofielen` en `relaties`;
4. de benodigde indexes op die koppelingen;
5. afzonderlijk beoordeelde classificatie-seeddata.

Voor zo'n DDL-BUILD is opnieuw expliciete doelbevestiging nodig. Tot die tijd blijft `vyjoc...` ongewijzigd.
