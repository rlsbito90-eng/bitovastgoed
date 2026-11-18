# CRM-inventarisatie: direct bewerken in het dossier
**Peildatum:** 18 november 2026  
**Doel:** na de eerste registratie werk je vanuit Objecten en Relaties zelf. Het grote formulier wordt een uitzonderingsroute, niet de standaard.

## UX-contract
1. **Eerste keer:** kort aanmaakformulier met kerngegevens, daarna naar de detailkaart.
2. **Daarna:** klik een bestaande waarde, bewerk inline en sla zonder extra bevestiging op. Als je een tekstveld verlaat, volgt autosave.
3. **Toetsenbord:** Enter slaat éénregelige velden op; Ctrl/Cmd+Enter slaat meerregelige notities op; Escape annuleert.
4. **Feedback:** subtiele status 'Opslaan…'/'Opgeslagen'; bij fouten duidelijk herstel; waar passend 'Ongedaan maken'.
5. **Geen dubbele invoer:** bestaande entiteiten via zoekbare keuzelijsten, geen tweede kopie van hun naam of contactgegevens.
6. **Wel expliciete bevestiging:** definitieve transactie-/biedingsbeslissingen, verwijderen, archiveren en andere risicovolle mutaties.
7. **Geen dataverlies:** historische losse velden blijven vindbaar; nooit een automatische fusie zonder gecontroleerde bron.

## Concrete inventarisatie en prioriteit

| Prioriteit | Onderdeel | Huidige situatie/risico | Doelinteractie | Bron van waarheid |
|---|---|---|---|---|
| P0 | Eigenaar/verkoper koppelen op bestaand object | Uitgebreid bewerkformulier had nog vrij veld `verkoperNaam` | Zoek een bestaande relatie op de objectkaart; nieuwe relatie direct aanmaken | `eigenaarRelatieId` → Relaties |
| P0 | Historische contactvelden | `verkoperNaam`, `verkoperEmail`, `verkoperTelefoon` naast relatie | Historische gegevens ingeklapt, niet ongevraagd kopiëren of wissen | Relaties primair; historische velden alleen aanvullende bron |
| P0 | Verkoopmotivatie | Via bewerkformulier of read-only op de objectkaart | Klik 'Wijzigen', edit inline, autosave, undo | `verkoopmotivatie` op Object |
| P0 | Taken bij Objecten en Relaties | Meer dan één bron/alleen beperkte zichtbaarheid, taakformulier voor elke actie | Uitklapbare takenlijst, direct afronden, details indien nodig | Taken + entity/deal-koppelingen |
| P1 | Vraagprijs en prijsindicatie | Groot objectformulier voor prijswijziging | Beveiligde inline euro-invoer op detailkaart | Vraagprijs en prijsindicatie apart |
| P1 | Jaarhuur en huursituatie | Objecttotalen en huurdersregels kunnen naast elkaar bestaan | Open onderliggende huurdersregels; toon bron en afwijking | Huurdersregels of expliciete objectwaarde, niet stilzwijgend overschrijven |
| P1 | Status, aanbiedingswijze, exclusiviteit | Bewerkformulier openen voor vaak voorkomende keuzes | Compacte dropdown/chips in objectheader | Objectstatus/aanbiedingswijze; pipelinefase blijft apart |
| P1 | Koppeling makelaar, aanbieder, beheerder en contactpersoon | Meerdere losse naam- en e-mailvelden | Rollen koppelen aan bestaande Relaties én hun contactpersonen; nieuwe toevoegen | Relaties/Contactpersonen; model ondersteunt mogelijk later meerdere rollen |
| P1 | Investeringscriteria en regio's | Inline deels beschikbaar, maar ook tekstvelden voor structureerbare criteria | Direct meerkeuze, vaste taxonomie, regio-/plaatskiezer | Relatie/Zoekprofiel; harde versus gewenste eisen expliciet |
| P1 | Volgende actie / vervolgdatum | Verschillende losse notities en taakvelden | Eén direct wijzigbare taak vanuit dossier; geen concurrerende 'volgende actie' | Taken |
| P2 | Adres en kadaster | Losse adresgegevens; BAG-verificatie aanwezig | Gestructureerde, geverifieerde adreskeuze; direct aanvullen | Objectadres, BAG/kadaster provenance |
| P2 | Oppervlakte en eenheden | VVO, BVO, GBO en totaal door elkaar mogelijk | Inline numeriek mét meetsoort/bron, geen verwisselbare m² | Objectoppervlakten met expliciete definitie |
| P2 | Eigendomssituatie | Nog als vrij tekstveld ingevoerd | Keuze vol eigendom/erfpacht/opstal/anders + toelichting | Juridische objectgegevens |
| P2 | Aankooptermijn, financieringsstatus, besluitvorming | In Relaties deels als vrije tekst | Vaste keuze + optionele toelichting; behoud aangeleverde originele tekst | Investeringsprofiel |
| P2 | Relaties en portefeuilles | Parent-objecten wel koppelbaar; meerdere eigenaars/adressen vereisen aandacht | Zoekbare entity-koppelingen; inventariseer kardinaliteit per object | Object↔relatie en object↔object relaties |
| P3 | IM-/marketingteksten, risico's en procesvoorwaarden | Vrije toelichtingen | Vrije tekst behouden, maar rechtstreeks op detailkaart schrijven | Objecttekstvelden |
| P3 | Documentstatus en bron | Status verspreid over dossier | Inline status per document (ontvangen/opgevraagd/ontbreekt), rechtstreeks uploaden | Documentenmodule |
| P3 | Aanbiedingen, biedingen en commissie | Risicovolle, historische gebeurtenissen | Snelle aparte acties met gecontroleerde invoer, géén blind autosave | Aanbiedings- en biedhistorie / Deal |

## Welke invoer hoort waar?
- **Relatie/persoon/zaak:** zoekbare entity picker + ID, geen vrij tekstveld als primaire registratie.
- **Status, eigendomsvorm, type, regio:** keuzelijst, chips of geverifieerde selectie.
- **Bedrag, percentage, m², deadline:** invoer met eenheid, bron en validatie; berekende waarden niet handmatig dupliceren.
- **Motivatie, context, risico, uitzonderingen:** vrije tekst; gebruikers moeten nuances kunnen vastleggen.
- **Gebeurtenissen zoals aanbod, tegenbod, afronding:** eigen workflow met historie en waar nodig bevestiging.

## Opgeleverd in eerste slice
- Eigenaar kiezen via relatie-ID op Objecten → Overzicht én in het uitgebreide formulier.
- Nieuwe relatie vanaf het object kunnen aanmaken.
- Verkoopmotivatie direct wijzigen in Objecten → Overzicht.
- Historische losse verkoper-/contactgegevens behouden onder aanvullende details.
- Bij Relaties en Objecten open taken uitklappen, direct afronden en uitgebreid bewerken waar nodig.

## Nog te toetsen vóór verder uitbouwen
- Kan één object meerdere juridische eigenaren, aanbieders of tussenpersonen hebben? Zo ja: aparte rolkoppelingen i.p.v. één eigenaar-ID.
- Welke informatie moet worden gedeeld met IM/1-pager, en welke is uitsluitend intern?
- Welke velden mogen direct autosaven en welke moeten een waarschuwing of goedkeuring krijgen?
- Houd mobiele interactie en toetsenbordgebruik gelijkwaardig; geen lange formulieren voor eenvoudige wijzigingen.

**Uitgangspunt:** informatiedichtheid omlaag, bereikbaarheid en correctheid omhoog. Niet simpelweg alle tekstvelden vervangen: schrijfvelden zijn terecht voor toelichting; entity-referenties en selecties zijn terecht voor structurele gegevens.
