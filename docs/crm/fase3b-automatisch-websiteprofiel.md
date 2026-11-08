# Fase 3B — automatische relatiekaart uit website-investeringsprofiel

**Datum:** 8 november 2026. **Eén bron:** `Relaties` in Bito CRM. Geen nieuwe `Zoekprofielen`.

## Reeds live: fase 3A

- CF7 WordPress → `website-investor-intake` → `website_investor_intakes`, met oorspronkelijke formulierantwoorden.
- Authenticated interne gebruiker ziet de inbox onder Relaties.
- Exacte e-mailcontrole leidt een bestaand contact naar beoordeling.
- Succesvolle fictieve testinzending aanwezig; geen relatie of zoekprofiel aangemaakt.

## Nieuwe 3B-functie

- Supabase migratieversie `20261108205554`: `website_intake_credentials.auto_create_enabled` (default **FALSE**) + RPC `public.process_website_investor_intake(uuid)`.
- Postgres-functie is **SECURITY INVOKER**, uitsluitend `service_role` mag hem aanroepen; `anon` en `authenticated` expliciet geweigerd.
- De ontvangstfunctie roept RPC direct **na** het opslaan van een nieuwe, nog niet herkende inzending aan. Als de opt-in uitstaat of validatie niet slaagt, blijft de originele intake aanwezig.
- Fictieve/test-e-maildomeinen worden nooit automatisch geïmporteerd.
- Een unieke event-ID voorkomt dubbel ontvangen; een advisory transaction lock op e-mail voorkomt dubbel aanmaken bij gelijktijdige verzoeken.
- Exacte e-mailhit in `relaties` of contactpersonen: status `bestaande_relatie`, bestaande gegevens **niet aanpassen**.
- Elke vergelijkbare bestaande naam, organisatie of telefoon (inclusief contactpersonen): status `dubbelzinnig`, **geen nieuwe relatie**.
- Gebrekkige/privacyloze of niet eenduidige `party-type`, `asset-types`, `search-area` en `investment-size`: **handmatige controle**.
- De bevestigde websitekeuzes worden eenduidig gemapt naar `property_type_ids`, `asset_classes`, `vastgoed_strategieen`, `budget_min/max` en overige Relaties-velden. De originele formulierdata blijft daarnaast onaangetast in `raw_payload`.
- Provincies en 'Heel Nederland' alleen bij expliciete, herkende gebiedskeuze. Afstandsradius of vrije locatie zoals '35 km vanaf Amersfoort': **handmatig**, niet automatisch regio verbreden.
- Alleen één eenduidige budgetband wordt in harde min/max omgezet. Meerdere ranges of onduidelijke waarden: controle.
- Rendementsbanden (bijv. 6–8%) worden **niet** als harde rendementsondergrens geïnterpreteerd.
- Geslaagde creatie is één atomaire databaseactie: Relatie + primaire contactpersoon + bronnotitie + intakestatus `verwerkt` met link naar relatie.
- De dashboard-inbox kan ook verwerkte records tonen. Bij bestaande contacten kan de gebruiker na handmatige controle de intake als beoordeeld markeren; daarmee worden géén relatievelden gewijzigd.

## Veiligheid en rollback

- Kill switch: `UPDATE public.website_intake_credentials SET auto_create_enabled=false WHERE source='cf7_investor_profile';`
- De gewone WP→Supabase ontvangst blijft bij uitschakeling gewoon functioneren.
- De servercredential `enabled` is een **afzonderlijke** schakelaar voor de hele ingestroom.
- SQL en functie in git met exact remote migratieversienummer.
- Geheim van WordPress nooit in git/clients/logs of de database in platte tekst.

## Uitgevoerde transactietests (ROLLBACK; geen testrelaties achtergebleven)

1. Nieuwe fictieve belegger, budget €500k–€1m, provincie Noord-Brabant en twee vastgoedsegmenten: **één relatie, één primaire contactpersoon, intake verwerkt**.
2. Exact bestaand e-mailadres: `bestaande_relatie`, geen nieuwe relatie.
3. Bestaand telefoonnummer bij een ander e-mailadres: `dubbelzinnig`, geen nieuwe relatie.
4. Ongevalideerde zoekradius: `nieuw_te_controleren`, geen nieuwe relatie.
5. Privacytoestemming ontbreekt: `nieuw_te_controleren`, geen nieuwe relatie.
6. Functiepermissies: `anon=false`, `authenticated=false`, `service_role=true`.

**Release:** automatisch aanmaken blijft **UIT** totdat CI, TypeScript, preview en de veiligheidscontrole zijn geslaagd. Na vrijgave alleen de genoemde switch aanzetten; niet oude openstaande intakes achteraf bulkverwerken. De reeds aangeleverde testinzending mag niet automatisch een relatie worden.
