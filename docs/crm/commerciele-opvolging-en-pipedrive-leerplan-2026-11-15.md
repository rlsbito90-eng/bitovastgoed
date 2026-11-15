# Bito CRM — commerciële werkstroom en actiegericht dashboard
**Uitvoeringsplan, 15 november 2026.** Basis: bestaande CRM op `crm-test`. Status: stap 1 in aparte featurebranch; geen productierelease.

## Doel en ontwerpregels
Bito CRM helpt de adviseur bepalen: **welke object-/kandidaatkans verdient nu actie, wie is aan zet en wat is de eerstvolgende concrete stap?** Het systeem moet minder handelingen vragen dan het oplevert. Geen tweede registratie naast bestaande Taken, Kandidaten of Deals, en geen automatische feitelijke conclusies uit onvolledige data.

- **Actie nodig:** gebruiker moet ondernemen (bijv. ontvangen bod, verlopen bewakingsmoment, urgente open taak).
- **In afwachting:** een externe partij is aan zet; toon een bewakingsdatum als die bekend is, zonder verplichte extra taak.
- **Bewust geparkeerd:** niet verbergen of onterecht als achterstallig presenteren; behoud oorspronkelijke context en geschiedenis.
- **Gesloten:** afgevallen/afgerond/verkocht telt niet als actieve werkvoorraad, maar blijft historisch vindbaar.
- Kandidatenstatus, taakstatus, dealfase en objectstatus zijn verschillende begrippen; maak ze niet stilzwijgend gelijk.

## Huidige toestand (read-only vastgesteld)
- `DashboardPage` gebruikt `bepaalAandacht` en een aparte werklijst met doorgeschoven taken.
- `bepaalAandacht` signaleert open biedingen, objecten zonder betekenisvolle activiteit en zonder kandidaten; `on_hold` staat apart.
- Bestaande stiltebasis: >14 dagen zonder activiteit, of >7 dagen bij een open bieding. `wacht_op_reactie` bestaat al als taakstatus, maar is nog geen volledig geïntegreerde object-/kandidaatbewaking.
- `ObjectPipelineSectie` koppelt meerdere beleggers aan één object; aanbiedingen en reacties hebben aparte registraties, maar een overkoepelende commerciële tijdlijn moet nog op volledigheid/dubbelingen worden getoetst.
- Er bestaat een gescheiden `crm-test`-frontend met **uitsluitend client-side fictieve demo**, géén volledige CRUD-testomgeving. De andere Vercel-previews hebben nog een verwijzing naar de productiedatabase; zij zijn niet geschikt voor mutatietests.
- `crm-test` wijkt aanzienlijk van `main` af. Synchronisatie/merge uitsluitend na beoordeling van wijzigingen, niet blind.

## Werkpakket 0 — Test- en releasediscipline (voorafgaand aan DB-werk)
1. Branches: `main` productie, `crm-test` afgescheiden ontwikkeling, specifieke featurebranches via PR.
2. Frontend unit- en componenttests in CI; SQL-tests in een wegwerp-Postgres-container met fictieve gegevens.
3. Voor echte browser-CRUD: pas beginnen na verifiëren van **een afzonderlijke database** met eigen project-URL en publieksleutel; staging nooit met service-role of productiedata uitvoeren.
4. Supabase-project/branch alleen aanmaken na actuele prijscontrole en eventuele expliciete kostentoestemming. Geen hergebruik van `bito-bag-shadow` zonder onderzoek.
5. Voor iedere mutatie: RLS/ownership, terugvalpad, auditbehoud, performancecheck, regressietests. Geen deployment of SQL op productie zonder afzonderlijke review.

## Werkpakket 1 — Eén betrouwbaar commercieel model (hoogste architectuurprioriteit)
- **Relatie**: partij en meerdere investeringsmandaten.
- **Object/propositie**: te verkopen vastgoed/pakket met aanbieder en scope. Bestaande objectstructuur behouden totdat migratieontwerp afzonderlijk is gevalideerd.
- **Kandidaat bij propositie**: koppeling met unieke relatie/propositie-combinatie en eventuele aanbieding, reactie, fase, laatste betekenisvolle voortgang.
- **Deal/transactie**: pas vanaf concreet onderhandelingstraject; één object kan meerdere kandidaten hebben zonder voor iedere teaser een volledige deal te creëren.
- **Taak**: de ene bestaande taakbron, met de juiste relatie/object/kandidaat/deal-koppeling. Voorkom dubbele taken via legacy-dealvelden én nieuwe opvolgvelden.
- Controleer bestaande foreign keys, lifecycle, labels en UI-routes; rapporteer eerst conflicten en ontbrekende relaties. Geen automatische historische herschrijving.

**Klaar wanneer:** vanuit een object alle kandidaten en vervolgstappen zichtbaar zijn, vanuit een relatie alle voorgestelde objecten, en vanuit een onderhandeling de relevante dossierhistorie. Geen dubbel getelde aanbiedingen of deals.

## Werkpakket 2 — Actiegericht dashboard en opvolging (eerst realiseren)
**2A. Reeds gestart op featurebranch (geen DB-migratie):**
- Conservatieve fasebewuste signalering. Bij precies één actieve kandidaat mag het CRM sneller attenderen: onderhandeling/indicatieve bieding/LOI/KO-concept na >3 dagen, interesse/bezichtiging geweest/DD na >7 dagen.
- Bij meerdere actieve kandidaten of onbekende fases blijft 14 dagen gelden (7 bij open bod). Dit is bewust: een recent contact met koper B mag stilte bij koper A niet als objectbrede voortgang maskeren.
- Reeds geplande opvolging blijft het bestaande signaleringsbeleid bepalen. Geen extra taak, verplicht veld of schijnbare datumcontrole.

**2B. Eerstvolgende functionele stap:**
- In de weergave `Aandacht nodig` strikt onderscheid: **Actie nodig**, **In afwachting**, **Geparkeerd**. Hergebruik `wacht_op_reactie`, `on_hold`, deadlines en plandata.
- Wachten zonder bewakingsdatum blijft in een aparte, zichtbare sectie, niet oneindig onzichtbaar. Een bewakingsmoment dat is bereikt, vraagt aandacht; het is niet automatisch een verstreken harde deadline.
- Voorkom ruis wanneer meerdere taken voor één object bestaan, wanneer een vervolgstap al gepland is of wanneer een object bewust on hold staat.
- Na taakafronding: met één handeling nieuwe taak plannen, op reactie wachten of afsluiten; geen verplichte bevestiging voor normale acties.
- Verbind signalering aan **betekenisvolle commerciële voortgang**, niet aan willekeurige `updatedAt` van metadata.

**Klaar wanneer:** een object met één geplande opvolging niet herhaaldelijk waarschuwt, wachtende dossiers terugvindbaar blijven en biedingen niet achter gewone to-do's verdwijnen.

## Werkpakket 3 — Kandidaat- en dealworkflow
- Houd `Kandidaat toevoegen` primair; aanbieding/reactie onder `Meer` of contextuele acties. Eén plek voor historie.
- Maak bulkacties mogelijk voor aanbieding, fase, reactie en afwijzing; atomair opslaan, herstel/undo en duidelijke foutafhandeling. Bestaande bulkcontracten eerst testen.
- Afwijscategorie verplicht bij expliciet 'Afgevallen', met optionele vrije toelichting wanneer nodig. Geen dubbele afwijzingstaxonomie.
- Onderscheid *kandidaat afgehaakt* van *hele transactie mislukt*. Alleen echte bieding/onderhandeling telt als concrete deal.
- Rapportage: aantallen benaderd, gereageerd, interesse, bezichtiging, bod, transactie, afwijzingscategorie en doorlooptijd.

## Werkpakket 4 — Eén tijdlijn en frictieloze invoer
- Tijdlijn per object en relatie uit bestaande gebeurtenisbronnen; duidelijke datum, auteur/kanaal, betrokken partijen en bron.
- Dedupe met stabiele gebeurtenis-ID's; geen dubbele tijdlijnitems voor 'aanbieding' en 'kandidaat' zonder echt afzonderlijke handeling.
- Inline bewerken, Enter opslaan bij enkelregelige velden, autosave-indicator, herstel waar mogelijk; mutaties met risico vragen gericht bevestiging.
- Mail-/agendakoppeling pas na inzicht in privacy, rechten, matching bij meerdere proposities en eventuele kosten.

## Werkpakket 5 — Controle, uitrol en succesmeting
1. Test de kernscenario's met fictieve objecten en kopers: één object met 10 kandidaten; één koper met 5 objecten; open bod; wachten op reactie; tijdsoverschrijding; bewuste pauze; dubbele aanbieding; verloren kandidaat; gesloten transactie.
2. Check dat bestaande data, taken, gerelateerde records, autorisaties en commerciële historie intact blijven.
3. Run typecheck, unit/component/e2e, RLS/SQL-tests, plus controlevragen op performance en query-volume. Preview moet aantoonbaar los van productie staan voor CRUD.
4. Eerst PR naar `crm-test`, review en test, daarna apart besluit over productiemerge. Ook productie rollback-plan vastleggen.
5. Evalueer na gebruik: aantal clicks voor aanbieden/reactie/opvolgen, onterecht getoonde waarschuwingen, onbeheerde open biedingen, dossiers zonder duidelijke eigenaar/volgende stap en bijhouden in minuten per dag.

## Scope en stopregels
- **Nu:** pure fasebewuste dashboardregel en regressietests, zonder databaseaanpassing.
- **Niet nu:** automatische complete pipeline-migratie, mail-sync, AI-scores, nieuwe achtergrondcronjobs of verplaatsing naar productie.
- Vermijd extra kosten en I/O; bereken signalen uit bestaande data/memoization of lichte query, geen polling.
- Gegevens die ontbreken = `onbekend`, niet stilzwijgend `voldaan` of `afgewezen`.

## Nog te bewijzen vóór een volledige release
- De bronidentiteit van taken op object-, kandidaat- en dealniveau; omgaan met `wacht_op_reactie` inclusief bewakingsdatum.
- Werkelijke kandidaat-specifieke laatste *betekenisvolle* contactdatum vs. objectbrede `updatedAt`.
- Compleetheid van object–relatie–kandidaat–deal-koppelingen en afwijzingsredenen.
- Een veilige staging-auth- en databaseconfiguratie voor interactief testen.

**Releasecriterium:** geen nieuwe knop of verplichte invoer zonder aantoonbare tijdwinst of betere transactieopvolging; geen SQL/database-write op productie vanuit testomgeving.
