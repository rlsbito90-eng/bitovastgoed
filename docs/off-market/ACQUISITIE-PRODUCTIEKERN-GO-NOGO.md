# PLAN A — Go/no-go-checklist voor BUILD A

Deze checklist voorkomt dat de productiekern wordt gebouwd op onbewezen aannames. BUILD A start pas wanneer alle blokkerende punten aantoonbaar zijn beantwoord.

## Actuele releasebasis — 8 augustus 2026

De voorbereidende BUILD-A-kern heeft inmiddels aantoonbaar de volgende bewijzen:

- actuele CRM-productie-DDL is via de bestaande Lovable-databasebinding uitsluitend read-only gecontroleerd;
- actuele RLS, policies, grants en `is_intern_gebruiker` zijn read-only gecontroleerd;
- live `off_market_brieven_status_check` staat nog op `concept | verstuurd`;
- live briefverdeling tijdens de probe: 27 `concept`, 69 `verstuurd`;
- geen van de nieuwe BUILD-A-tabellen of transactionele functies bestaat momenteel in productie;
- de migratiedraft houdt daarom legacy `verstuurd` transitief geldig en voert geen automatische backfill uit;
- drie SQL-drafts zijn in tijdelijke PostgreSQL 17 aantoonbaar rollbackbaar;
- nummeruitgifte is onder concurrency getest;
- operation-key-idempotentie en postregistratie-idempotentie zijn geïsoleerd getest;
- de aaneengesloten dagelijkse databaseflow is groen in `Acquisitieproductiekern DB Proof` run `31259895456`;
- de E2E-flow bewijst twee geadresseerden in één batch, `geprint != gepost`, correcte `gedeeltelijk_gepost`-status, opvolging uitsluitend na `brief_gepost`, idempotente postretry en atomische rollback bij optimistic-lock-conflict;
- legacy `verstuurd`-brieven en oude conceptbrieven zonder formele `selectie_id` worden niet kunstmatig als productiekernbrief geïnterpreteerd;
- clientrollen houden geen directe EXECUTE-rechten op de nieuwe transactionele RPC-functies;
- productieactivatie, migratie, backfill en grants zijn niet uitgevoerd.

### Nog blokkerend voor productiegebruik

De groene E2E-proef is **geen productieakkoord**. Voor productiegebruik blijven minimaal open:

1. definitief release-/migratiebestand opstellen uit de review-drafts;
2. expliciet bepalen welke gerichte RLS-policies en RPC execute-grants de productiekern krijgt;
3. resterende write-repositories voor de vroege dagflow (`startVerwerking`, briefversie/batch-aanmaak en batchkoppeling) definitief invullen of expliciet buiten BUILD A houden;
4. frontend werkelijk koppelen aan formele productiekernrecords zonder de bestaande legacy-flow te breken;
5. preview/handmatige gebruikersacceptatie van de dagelijkse hoofdflow;
6. volledige regressie-/typecheck-/production-buildstatus opnieuw op de finale PR-head beoordelen;
7. afzonderlijk expliciet productieakkoord vóór enige migratie of activatie.

## 1. Bestaande CRM-contracten

- [ ] Bestaande tabellen en velden voor selectie, brieven, geadresseerden, printen, posten en opvolging zijn geïnventariseerd.
- [ ] Bestaande hooks, RPC's, Edge Functions en Storage-paden zijn geïnventariseerd.
- [ ] Bestaande RLS-policies en rollen zijn geïnventariseerd.
- [ ] Vastgesteld welke bestaande velden tijdens de overgang leesbaar en schrijfbaar blijven.
- [ ] Vastgesteld welke velden canoniek worden en welke alleen compatibiliteit bieden.

## 2. Acquisitiedossier en werkbakken

- [ ] Het canonieke dossierobject is vastgesteld.
- [ ] `verwerking_gestart_op` wordt uitsluitend via een expliciete gebruikershandeling gezet.
- [ ] `Acquisitieselectie (x)` is gelijk aan de werkbak `Nieuwe selectie`.
- [ ] Iedere actieve dossierstatus valt in precies één primaire werkbak.
- [ ] KPI's zoals `Geblokkeerd`, `Geadresseerden` en `Opvolging verlopen` zijn geen primaire werkbakken.
- [ ] Bestaande dossiers kunnen zonder dataverlies worden geclassificeerd.

## 3. Briefnummering en versies

- [ ] Formaat `BRYYYYNNNNNN` is definitief.
- [ ] Nummeruitgifte is atomair en concurrency-safe.
- [ ] Geannuleerde nummers worden niet hergebruikt.
- [ ] Eén brief hoort bij precies één geadresseerde.
- [ ] Briefversies zijn immutabel na generatie.
- [ ] Een verzonden versie wordt vergrendeld.
- [ ] Correctie na verzending leidt tot een nieuw briefnummer.
- [ ] Geadresseerde-snapshots blijven historisch onveranderd.

## 4. Batchnummering en batchbeheer

- [ ] Formaat `BATYYYYMMDDNN` is definitief.
- [ ] Dagreeks wordt atomair uitgegeven.
- [ ] Eén briefversie kan niet in twee actieve batches zitten.
- [ ] Conceptbatch is wijzigbaar.
- [ ] Wijziging na documentgeneratie vereist heropenen en regenereren.
- [ ] Wijziging na printen leidt tot een aanvullende batch.
- [ ] Geposte batchinhoud is vergrendeld.
- [ ] Gedeeltelijk geprinte en gedeeltelijk geposte batches hebben expliciete statussen.

## 5. Documentproductie

- [ ] Gecombineerde brieven-PDF is versieerbaar.
- [ ] Labelbestand is versieerbaar.
- [ ] Controlelijst bevat het batchnummer in de kop.
- [ ] Controlelijst bevat het batchnummer en paginanummer in iedere voettekst.
- [ ] Batchvoorblad toont aantallen dossiers, brieven, labels, pagina's en afwijkingen.
- [ ] Oude documentversies blijven beschikbaar als `vervallen`.
- [ ] Bestandsnamen bevatten brief- of batchnummer en documentversie.

## 6. Printen en posten

- [ ] Printdatum en verzenddatum zijn afzonderlijke gebeurtenissen.
- [ ] `Geprint` impliceert nooit automatisch `Gepost`.
- [ ] Opvolging ontstaat alleen na bevestigde verzending.
- [ ] Herdrukken worden afzonderlijk gelogd.
- [ ] Niet-verzonden brieven binnen een geprinte batch krijgen een expliciete afwijking.
- [ ] Dubbel printen en dubbel posten geven een blokkade of expliciete waarschuwing.

## 7. Zoeken en koppelingen

- [ ] Volledig en gedeeltelijk briefnummer is zoekbaar.
- [ ] Volledig en gedeeltelijk batchnummer is zoekbaar.
- [ ] Zoekinvoer wordt alfanumeriek en hoofdletterongevoelig genormaliseerd.
- [ ] Brief is herleidbaar naar signaal, dossier, object en relatie.
- [ ] Batch is via batchbrieven herleidbaar naar dezelfde context.
- [ ] Afleidbare koppelingen worden niet dubbel opgeslagen zonder noodzaak.

## 8. Audittrail en verwijderregels

- [ ] Alle nummeruitgiftes worden gelogd.
- [ ] Toevoegen en verwijderen uit een conceptbatch wordt gelogd.
- [ ] Genereren, heropenen, printen, posten, annuleren en herdrukken worden gelogd.
- [ ] Uitgegeven nummers worden nooit hard verwijderd.
- [ ] Verzonden snapshots worden nooit hard verwijderd.
- [ ] Auditrecords zijn append-only vanuit de applicatie.

## 9. Migratie en backwards compatibility

- [ ] Bestaande brieven zijn geclassificeerd als automatisch migreerbaar, handmatig beoordelen of alleen historisch bewaren.
- [ ] Geen fictieve historische nummers worden zonder controle toegekend.
- [ ] Rollbackstrategie is vastgelegd.
- [ ] Bestaande schermen blijven tijdens de overgang functioneren.
- [ ] Pariteitstests bewijzen dat bestaande tellingen niet onverwacht wijzigen.
- [ ] Geen productieactivatie voordat migratie- en integriteitscontroles groen zijn.

## 10. Veiligheid en release

- [ ] Geen automatische Kadasterhandeling toegevoegd.
- [ ] Geen Lovable-afhankelijkheid toegevoegd.
- [ ] RLS-tests zijn groen voor lezen, aanmaken, wijzigen en blokkeren van verboden acties.
- [ ] Typecheck is groen.
- [ ] Production build is groen.
- [ ] Regressietests zijn groen, afgezien van expliciet vastgelegde bestaande baselinefouten.
- [ ] Preview is handmatig gecontroleerd op de dagelijkse hoofdflow.
- [ ] Productieactivatie vereist een afzonderlijk expliciet besluit.

## Go/no-go-regel

BUILD A mag worden geopend als draft voor voorbereidende code, maar database-activatie, backfill en productiegebruik blijven geblokkeerd zolang een blokkerend checklistpunt niet aantoonbaar groen is.
