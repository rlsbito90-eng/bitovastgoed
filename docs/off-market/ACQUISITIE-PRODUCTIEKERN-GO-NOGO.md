# BUILD A — Go/no-go-checklist Acquisitieproductiekern

Dit document is het actuele review- en releasecontract voor de Acquisitieproductiekern. Groen bewijs uit CI of geïsoleerde databaseproeven verleent **nooit automatisch productieakkoord**.

## Actuele status — 8 augustus 2026

### Bewezen

- actuele CRM-productie-DDL, RLS, policies, grants en `is_intern_gebruiker` zijn uitsluitend read-only gecontroleerd via de bestaande CRM-databasebinding;
- live `off_market_brieven_status_check` ondersteunt nog `concept | verstuurd`; de migratiedrafts behouden legacy `verstuurd` transitief en voeren geen automatische backfill uit;
- nieuwe BUILD-A-tabellen en transactionele functies bestaan niet in productie;
- vijf vroege en vier latere transactionele RPC's zijn uitgewerkt en geïsoleerd bewezen;
- de canonieke securityarchitectuur gebruikt publieke security-wrappers vóór niet-client-callable `*_intern` implementaties;
- no-JWT, niet-interne gebruiker en actor-spoofing worden fail-closed geweigerd; de geldige interne actorroute schrijft wel en produceert precies de bedoelde audit;
- least-privilege activatie is geïsoleerd bewezen: alleen vier readmodellen krijgen toekomstige `SELECT`, alleen negen publieke wrappers toekomstige `EXECUTE`; directe writes, helper en `_intern` blijven gesloten;
- `Acquisitieproductiekern DB Proof` run `31263471996` is groen voor kern-SQL/rollback/concurrency, volledige dagflow-E2E, auth/actor-spoofing en activatie-RLS/ACL;
- documentproductie voor batchvoorblad, controlelijst, brieven-PDF en adreslabels is geïmplementeerd zonder dat downloads zelf database- of statusmutaties uitvoeren;
- de bestaande CRM-Supabase-browserclient is via een smalle adapter aan de formele readketen gekoppeld;
- de readketen blijft centraal bewijs-gepoord en standaard gesloten; zonder expliciet leesbewijs wordt `client.from(...)` niet bereikt;
- productiekern-dossiers kunnen in één allowlisted bulkread op `selectie_id` worden geladen, met querybudget, retry/timeout, limieten en integriteitsbewaking;
- de Acquisitieselectie bevat een afzonderlijke read-only Productiekernstatusprojectie; deze heeft geen knoppen en beïnvloedt geen legacyfilters, sortering, werkbakken of writes;
- dezelfde bulkset ondersteunt observerende workflowpariteit legacy ↔ formele Productiekern zonder N+1-reads;
- gerichte Verify run `31264614402` op head `47680feb18bf483c150e9df0a94d3f5cd1e974e7` is volledig groen: typecheck, alle gerichte Acquisitieproductiekern-tests en production build;
- de algemene regressiesuite blijft bekend rood door dezelfde vijf reeds geaccepteerde baselinefails buiten de Productiekernscope; de laatste bekende algemene run had 542 geslaagde testbestanden, 4 rode, 2 skipped en 3100 geslaagde tests, 5 rode, 4 skipped;
- productieactivatie, productie-migratie, backfill, RLS/grantswijzigingen en Productiekernwrites zijn niet uitgevoerd.

## Nog open vóór technische review / merge

1. definitieve release-/migratiebestanden samenstellen uit de bewezen review-drafts, **zonder ze toe te passen**;
2. handmatige preview-acceptatie van de dagelijkse hoofdflow uitvoeren, inclusief PDF-/downloadgedrag en de observerende Productiekernprojectie;
3. op de finale PR-head opnieuw de gerichte Verify en de algemene regressie-/typecheck-/buildstatus vastleggen;
4. PR-reviewdossier en reviewcommentaar synchroniseren met de actuele implementatiestatus;
5. technische review uitvoeren en merge als afzonderlijke poort behandelen.

## Hard geblokkeerd zonder afzonderlijk expliciet productieakkoord

- productie-migraties toepassen;
- tabellen, constraints of functies in productie aanmaken/wijzigen;
- RLS-policies of grants wijzigen;
- backfill uitvoeren;
- read-only Productiekernactivatie voor echte gebruikers inschakelen;
- Productiekernwrites activeren;
- automatische Kadasterhandelingen toevoegen.

## 1. Bestaande CRM-contracten

- [x] Productie-DDL van de relevante legacy-acquisitieobjecten read-only gecontroleerd.
- [x] Actuele RLS/policies/grants en interne gebruikershelper read-only gecontroleerd.
- [x] Legacy briefstatus `verstuurd` als compatibiliteitsgrens vastgelegd.
- [x] Vastgelegd dat nieuwe BUILD-A-objecten nog niet in productie bestaan.
- [x] Geen automatische historische backfill ontworpen of uitgevoerd.

## 2. Acquisitiedossier en werkbakken

- [x] Canoniek dossiercontract vastgesteld.
- [x] Acht onderling uitsluitende operationele werkbakken vastgesteld.
- [x] `verwerking_gestart_op` is een expliciete procesmarkering en geen datumheuristiek.
- [x] KPI-kenmerken blijven buiten de primaire werkbakindeling.
- [x] Observerende legacy ↔ Productiekern-workflowpariteit is geïmplementeerd.
- [ ] Bestaande productiepopulatie handmatig beoordelen op concrete pariteitsafwijkingen zodra read-only activatie afzonderlijk is goedgekeurd.

## 3. Briefnummering en versies

- [x] Formaat `BRYYYYNNNNNN` vastgelegd.
- [x] Nummeruitgifte atomair/concurrency-safe bewezen.
- [x] Eén formele brief hoort bij één geadresseerde.
- [x] Briefversies en geadresseerde-snapshots zijn immutable volgens het Productiekerncontract.
- [x] Definitieve/verzonden toestand wordt vergrendeld volgens de transactionele keten.

## 4. Batchnummering en batchbeheer

- [x] Formaat `BATYYYYMMDDNN` vastgelegd.
- [x] Dagreeks concurrency-safe bewezen.
- [x] Batchstatussen onderscheiden concept, documenten, geprint, gedeeltelijk gepost, gepost en geannuleerd.
- [x] Geprint impliceert niet gepost.
- [x] Gedeeltelijk geposte batches blijven semantisch correct.

## 5. Documentproductie

- [x] Batchvoorblad geïmplementeerd.
- [x] Controlelijst geïmplementeerd.
- [x] Gecombineerde brieven-PDF geïmplementeerd.
- [x] Adreslabels-export geïmplementeerd.
- [x] Documentdownload verandert geen database- of productiestatus.
- [ ] Handmatig previewen van browserdownloadgedrag en documentuitvoer.

## 6. Printen, posten en opvolging

- [x] Printdatum en post/verzenddatum zijn afzonderlijke gebeurtenissen.
- [x] Post-before-print wordt geblokkeerd in de geïsoleerde dagflow.
- [x] Dubbele postregistratie is idempotent bewezen.
- [x] Partiële postregistratie blijft correct.
- [x] Opvolging ontstaat uitsluitend na bevestigde verzending in het bewezen procesmodel.
- [ ] Finale semantische review bevestigen dat postregistratie en dossier-/opvolgprojectie in de definitieve releaseketen volledig atomair gekoppeld zijn.

## 7. Readmodel, zoeken en frontend

- [x] Single reads zijn expliciet allowlisted.
- [x] Bulkreads zijn expliciet allowlisted en hard begrensd.
- [x] Bulk dossier-read filtert uitsluitend op `selectie_id`.
- [x] Onverwachte en dubbele dossierresultaten worden geweigerd.
- [x] Browserclient gebruikt de bestaande CRM-Supabase-client; geen tweede URL/key-configuratie toegevoegd.
- [x] Read-only frontendmount is fysiek aanwezig maar standaard gesloten.
- [x] Read-only Productiekernstatus en workflowpariteit hebben geen writebediening.
- [ ] Read-only productieactivatie alleen na afzonderlijk expliciet leesakkoord.

## 8. Audittrail en veiligheid

- [x] Operation-key-idempotentie bewezen.
- [x] Actor-spoofing geblokkeerd.
- [x] Niet-interne authenticated gebruiker geblokkeerd.
- [x] No-JWT-route geblokkeerd.
- [x] Verboden securityroutes produceren geen auditwrite.
- [x] Least-privilege RLS/ACL-activatiemodel geïsoleerd groen.
- [x] Geen automatische Kadasterhandeling toegevoegd.

## 9. Migratie en backwards compatibility

- [x] Legacy `verstuurd` blijft transitief geldig.
- [x] Oude legacybrieven zonder formele `selectie_id` worden niet kunstmatig als Productiekernrecord geïnterpreteerd.
- [x] Review-SQL staat buiten `supabase/migrations` en is niet op productie toegepast.
- [x] Rollback-/isolatieproeven zijn groen.
- [x] Bestaande legacy-Acquisitieselectie blijft operationeel leidend tijdens de overgang.
- [ ] Definitieve release-migratiebestanden afleiden uit bewezen drafts, reviewen en **niet toepassen** vóór afzonderlijk productieakkoord.

## 10. Release

- [x] Gerichte Productiekern typecheck groen op head `47680feb...`.
- [x] Gerichte Productiekern-tests groen op head `47680feb...`.
- [x] Production build groen op head `47680feb...`.
- [x] Bekende algemene regressiebaseline afzonderlijk vastgelegd; geen nieuwe Productiekernfail aangetoond.
- [ ] Handmatige preview-acceptatie dagelijkse hoofdflow.
- [ ] Finale regressie/typecheck/build op finale reviewhead.
- [ ] Technische review.
- [ ] Merge.
- [ ] Afzonderlijk expliciet productieakkoord vóór migratie/RLS/grants/activatie.

## Go/no-go-regel

**Status nu: GO voor verdere technische reviewvoorbereiding; NO-GO voor productie.**

De code mag als draft verder worden beoordeeld en releasebestanden mogen review-only worden voorbereid. Productiemigratie, backfill, RLS/grantswijzigingen, read-activatie en writes blijven geblokkeerd totdat de resterende reviewpunten groen zijn én voor de betreffende productiestap afzonderlijk expliciet akkoord is gegeven.
