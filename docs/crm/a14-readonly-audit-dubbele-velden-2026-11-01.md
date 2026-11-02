# CRM A14 — read-only audit van dubbele relatievelden

**Datum:** 1 november 2026  
**Omgeving:** Supabase productie `vyjocdlwfxrblusfngfq`; SQL uitsluitend SELECT.  
**Geen persoons- of organisatiegegevens opgenomen. Geen writes of schemawijzigingen uitgevoerd.**

## Nulmeting

| Controle | Aantal |
|---|---:|
| Alle relatierijen | 135 |
| Actieve relaties (`soft_deleted_at IS NULL`) | 92 |
| Gearchiveerde / soft-deleted relaties | 43 |
| Actief, nog zonder partijprofiel | 91 |
| Actief, met commerciële rollen vastgelegd | 1 |
| Actief, rol 'ontwikkelaar' geselecteerd | 0 |
| Actief, historisch hoofdtype 'ontwikkelaar' | 10 |
| Actief, oude investeerderscategorie gevuld | 51 |
| Actief, oude categorie Fonds/Family office | 1 |
| Actief, oude assetklassen gevuld | 34 |
| Actief, nieuwe algemene vastgoedtypen gevuld | 42 |
| Actief, algemene regio ingevuld | 44 |
| Actief, algemeen budget ingevuld | 26 |
| Actief, vrije aankoopcriteriatekst | 22 |
| Zoekprofielen totaal | 8 |
| Relaties met zoekprofielen | 7 |

Dit zijn momentopnames, geen bewijs dat een individuele partij een bepaalde strategie voert. De 135 totalen zijn inclusief gearchiveerde relaties en mogen niet worden verward met 135 actieve kandidaten.

## Vastgestelde technische afhankelijkheden

| Oude registratie | Huidige afnemer / betekenis | Migratievoorwaarde |
|---|---|---|
| `relaties.type_partij` | `RelatiesPage` historisch filter; `rolMandaatAdapter.routeType` legacy kandidaatselectie en `koperRelatieId`-beveiliging; andere CRM-code | Geen verwijdering vóór een nieuwe expliciete route voor kandidaten/brokers. |
| `relaties.commercial_roles` | `rolMandaatAdapter.routeType` (waaronder 'ontwikkelaar' als oude matchroute), `koperRelatieId` en routebevestiging | Rollen `ontwikkelaar`, `makelaar`, `bemiddelaar` zijn conceptueel overlap met Partijprofiel maar hebben nog matching-effect. Niet zonder vergelijking verwijderen. |
| `relaties.investeerder_subtype` | Oude gemengde classificatie en rechtsvorm; soms waarde Fonds/Family office | Rechtsvorm later scheiden van partijtype. Oude waarde per relatie beoordelen; geen blind kopiëren. |
| `relaties.asset_classes`, `property_type_ids`, `property_subtype_ids`, `deal_type_ids` | Algemene basiscriteria via `rolMandaatAdapter`; vastgoedweergave en filters | Vergelijk tegen concrete profielen; historische type-ID's en onbekende waarden behouden. |
| `relaties.regio`, `budget_min`, `budget_max` | Algemene kandidaatroute, budget- en regio-match | Niet wissen omdat een zoekprofiel bestaat; meerdere zoekrichtingen kunnen naast elkaar gelden. |
| `relaties.aankoopcriteria` | Vrije tekst voor commerciële interpretatie en selectie; geen veilig generiek gestructureerde equivalent | Alleen na inhoudelijke beoordeling of expliciete menselijke mapping samenvoegen. |
| `zoekprofielen` | Concrete aankoopcriteria voor matching; zelfstandige voorkeuren per relatie | Blijft primaire bron voor meerdere zoekrichtingen per partij. |

## A14-reductie van visuele dubbelen

- Relaties-lijst heeft nu **één** filter op Partijprofiel. Niet-ingevulde profielen zijn expliciet 'Nog niet geclassificeerd'.
- De oude typefilter is alleen nog als herkenbare categorie 'Historische hoofdindeling (tijdelijk)' beschikbaar, zodat een opgeslagen oude keuze niet stilzwijgend verandert.
- Een bewaarde v1-sessie met `typeFilter='belegger'` wordt als `legacy:belegger` overgenomen; niet als bewezen `profiel:belegger`.
- Op Relaties-lijst en detailpagina heeft een expliciet Partijprofiel voorrang in de leesweergave. Bestaande rolindicaties worden als **historisch en nog gebruikt voor matching** aangeduid.
- Inline Partijprofiel is beveiligd tegen onbedoeld sluiten en veranderingen elders aan hetzelfde veld.

## Uitfaseringsvoorstel — vóór A15/A16

1. Maak voor **ieder actief dossier** een voorstel van Partijprofiel met `bronveld`, onderbouwing, controlekwaliteit, gebruikersreview en optioneel 'Onbekend'.
2. Als het dossier alleen `type_partij='belegger'` meldt, **niet** automatisch Belegger kiezen.
3. Laat `commercial_roles` niet langer de zelfstandige aard van de onderneming vastleggen. Definieer voor Matching expliciet 'zoekprofiel actief' en een toetsbare 'eigen koper/namens opdrachtgever/onbekend'-status waar dit werkelijk nodig is.
4. Neem baseline-candidate-output via een afgeschermde test/snapshot; vergelijk **alle** relevante object/relatie/zoekprofielcombinaties op vóór/na, inclusief brokers, developing investors en profielen zonder mandaat.
5. Voer de overgang met wijzigingslog, export, controle en een formele terugdraairoute uit. Alleen daarna oude kolommen, formulierselecties, filters en compatibiliteitsregels definitief verwijderen.

**Geen automatische massamutatie en geen fysieke kolomverwijdering in A14.**
