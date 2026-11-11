# Objecten ↔ Relaties: verkooppartijen en herkomsthistorie

Status: fase 1 in PR #589, fase 2 hieronder als ontwerp. Geen automatische migratie van vrije tekst naar relaties.

## Huidige situatie

De tabel `objecten` heeft al `eigenaar_relatie_id` (FK naar `relaties`) en vrije teksten voor verkoper- en contactgegevens. De snelle objectaanmaak biedt een relatiepicker; de uitgebreide objecteditor nog niet. Een relatiekaart toont de verkoopobjecten niet als aparte historie.

## Fase 1 (PR #589)

- Kies via de bestaande `EntityPicker` een relatie in de uitgebreide objecteditor.
- Nieuwe verkoper/eigenaar **direct vanuit beide objectformulieren** aanmaken via bestaande `QuickCreateRelationDialog` (met duplicate-waarschuwingen en keuze voor bestaand).
- Na succesvolle aanmaak direct de relatie in de objectformuliertoestand selecteren; bij Opslaan wordt de FK definitief vastgelegd.
- Relatiekaart toont reeds gekoppelde objecten en huidige statussen, inclusief verkocht en gearchiveerd.
- Datum in historie is `objecten.created_at` (CRM-registratiedatum). Geen claim dat dit de dag van daadwerkelijke aanlevering is.
- Historische vrije tekst wordt uitsluitend na handmatige verificatie gekoppeld.

## Fase 2: echte herkomstrollen en aanleverhistorie

Maak één relationele bron van waarheid voor **meerdere partijen per object**:

- `object_partij_rollen` / `object_relaties`:
  `id, object_id, relatie_id, rol, is_primair, betrokken_vanaf, betrokken_tot, bron, toelichting, created_at`.
  Mogelijke rollen: `juridisch_eigenaar`, `verkoper`, `aanbrenger`, `verkopend_makelaar`, `beheerder`, `adviseur`.
- Herkomstgebeurtenissen afzonderlijk:
  `object_aanlevermomenten` met `object_id, relatie_id, datum_aanlevering, kanaal, bronreferentie, samenvatting, created_at`.
  Eén object kan door meerdere routes binnenkomen zonder fictief dubbel object.
- Voor contact/historie per relatie gebruikt het dashboard het object-/partijenregister en de gebeurtenislog, niet vrije naamovereenkomsten.
- Primair eigenaar-FK blijft tijdens migratie behouden; nieuwe rolregistratie mag geen dubbel object of dubbele pipeline genereren.
- Twee gescheiden getallen: **unieke aangedragen objecten** en **aantal aanleveringen** (hetzelfde pand meerdere keren is niet automatisch nieuw aanbod).
- Vergelijk ook verstreken tijd tussen aanlevering, eerste markttoets, bieding, verkoop en afwijzing.
- Laat bij een nieuwe aanlevering bekende objecten herkennen en bestaande dossiers bijwerken, in plaats van blind een duplicaat aan te maken.

### Praktische voorbeelden

- Directe eigenaar stuurt één object: hij is zowel `juridisch_eigenaar` als `verkoper`, met één aanlevermoment.
- Makelaar brengt portefeuille aan: makelaar is `aanbrenger` en `verkopend_makelaar`; juridische eigenaar is een andere relatie of nog onbekend.
- Een relatie biedt drie verschillende panden aan: drie objectkoppelingen en drie aanlevermomenten, eventueel één bronmail.
- Twee makelaars delen hetzelfde pand na elkaar: één object, twee onafhankelijke aanlevermomenten.
- Na verkoop blijft historiek beschikbaar, zonder het object opnieuw als actuele match aan te bieden.

## Niet doen

- E-mail- en telefoongegevens opnemen in zichtbare relatiepickerlabels.
- Een makelaar automatisch als juridische eigenaar opslaan.
- `created_at` gelijkstellen aan de werkelijke aanleverdatum.
- Namen uit vrije tekst automatisch matchen op `relaties.id`.
- Oude dossiers verwijderen om nieuwe relatierollen te introduceren.
- Zonder expliciete toestemming automatische communicatie naar betrokken partijen sturen.
