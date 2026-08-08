# BUILD A — Migratie- en rolloutontwerp acquisitieproductiekern

## Doel

Dit document vertaalt PLAN A naar een uitvoerbaar migratie- en rolloutpad zonder productie direct te activeren.

De aanpak is additief, backwards compatible en gefaseerd. Bestaande brieven, printstatussen en opvolgvelden blijven tijdens de overgang leesbaar. Nieuwe velden en tabellen worden pas canoniek nadat pariteit, integriteit en RLS aantoonbaar groen zijn.

## Uitgangspunten

- Geen destructive migration in de eerste release.
- Geen hard verwijderen van bestaande of nieuwe productiegegevens.
- Geen automatische nummerbackfill voor historische brieven zonder classificatie.
- Geen verandering van bestaande verzendlogica voordat dual-read en pariteit zijn bewezen.
- Geen automatische Kadasterhandeling.
- Geen productieactivatie zonder afzonderlijk expliciet besluit.

## Fase 0 — Read-only inventarisatie

Voor daadwerkelijke DDL moet de actuele productieomgeving read-only worden gecontroleerd op:

- kolommen en datatypen van `off_market_acquisitie_selectie`;
- kolommen en datatypen van `off_market_brieven`;
- kolommen en datatypen van `off_market_brief_events`;
- indexen en unieke constraints;
- triggers en databasefuncties;
- RLS-status en policies;
- grants aan `anon`, `authenticated` en service-rollen;
- aantallen actieve, gearchiveerde, concept- en verstuurde brieven;
- inconsistenties tussen `status`, `verzendstatus`, `printdatum`, `postdatum` en `verzonden_op`.

Deze fase wijzigt niets.

## Fase 1 — Additief dossiercontract

### Uitbreiding `off_market_acquisitie_selectie`

Voorgestelde additieve velden:

- `verwerking_gestart_op timestamptz null`;
- `verwerking_gestart_door uuid null`;
- `primaire_werkbak text null`;
- `volgende_actie_op date null`;
- `volgende_actie_omschrijving text null`;
- `updated_at timestamptz` alleen indien dit veld aantoonbaar al onderdeel is van het bestaande patroon.

### Regels

- `verwerking_gestart_op` wordt alleen gezet door een expliciete gebruikersactie.
- Zolang `verwerking_gestart_op` null is, valt het dossier in `nieuwe_selectie`.
- `primaire_werkbak` wordt niet blind gebackfilld vanuit bestaande afgeleide statussen.
- Bestaande records blijven geldig wanneer nieuwe velden null zijn.

### Werkbakconstraint

Toegestane waarden:

- `nieuwe_selectie`;
- `eigenaar_achterhalen`;
- `brief_opstellen`;
- `printklaar`;
- `geprint_posten`;
- `opvolgen`;
- `wachten`;
- `afgehandeld`.

De eerste migratie mag dit als check constraint toevoegen, maar pas nadat een nulwaarde voor bestaande records expliciet is toegestaan.

## Fase 2 — Briefidentiteit

### Uitbreiding `off_market_brieven`

Voorgestelde additieve velden:

- `briefnummer text null`;
- `actieve_versie integer null`;
- `acquisitie_selectie_id uuid null`;
- `object_id uuid null` indien het actuele objectcontract dit datatype bevestigt;
- `relatie_id uuid null`;
- `vervanging_van_brief_id uuid null`;
- `annuleringsreden text null`;
- `definitief_op timestamptz null`;
- `vergrendeld_op timestamptz null`.

### Constraints

- unieke partial index op `briefnummer where briefnummer is not null`;
- check op formaat `^BR[0-9]{10}$`;
- check `actieve_versie is null or actieve_versie >= 1`;
- self-reference voor `vervanging_van_brief_id`;
- geen verplichte foreign keys in dezelfde stap voordat bestaande object- en relatiecontracten zijn bevestigd.

### Historische brieven

Bestaande records worden eerst geclassificeerd:

1. **automatisch migreerbaar** — actieve conceptbrief met betrouwbare geadresseerde en zonder tegenstrijdige status;
2. **handmatige beoordeling** — tegenstrijdige print-/post-/verzendstatus of meerdere mogelijke geadresseerden;
3. **historisch bewaren** — oud/garchiveerd record waarvoor geen productie-identiteit nodig is.

Geen enkel bestaand record krijgt automatisch een fictieve verzendhistorie.

## Fase 3 — Briefversies

Nieuwe tabel: `off_market_brief_versies`.

Minimaal contract:

- `id uuid primary key`;
- `brief_id uuid not null`;
- `versienummer integer not null`;
- `status text not null`;
- `inhoud_snapshot jsonb not null`;
- `geadresseerde_snapshot jsonb not null`;
- `template_id text null`;
- `template_versie text null`;
- `bestand_referentie text null`;
- `aangemaakt_door uuid null`;
- `created_at timestamptz not null`;
- `vervallen_op timestamptz null`;
- `verzonden_op timestamptz null`.

Constraints:

- unique `(brief_id, versienummer)`;
- status in `actief`, `vervallen`, `verzonden`;
- maximaal één actieve versie per brief via partial unique index;
- verzonden versie mag vanuit de applicatie niet inhoudelijk worden gewijzigd.

## Fase 4 — Nummeruitgifte

Nieuwe interne tellerstructuur, bijvoorbeeld `off_market_nummerreeksen`.

### Briefnummer

Formaat:

`BR` + jaar + zescijferige reeks.

Voorbeeld:

`BR2026000482`.

### Batchnummer

Formaat:

`BAT` + `YYYYMMDD` + tweecijferige dagreeks.

Voorbeeld:

`BAT2026080601`.

### Databasefuncties

Voorgestelde security-definer functies:

- `reserveer_off_market_briefnummer(p_jaar integer)`;
- `reserveer_off_market_batchnummer(p_datum date)`.

Eisen:

- één transactie;
- row-level locking of atomische upsert;
- geen `max(...) + 1` zonder lock;
- geen nummerhergebruik;
- vaste `search_path`;
- execute-recht uitsluitend voor geautoriseerde CRM-rollen;
- directe writes naar tellerstructuur blokkeren voor applicatierollen.

## Fase 5 — Batchmodel

### Tabel `off_market_printbatches`

Minimaal contract:

- `id uuid primary key`;
- `batchnummer text unique not null`;
- `status text not null`;
- `documentversie integer not null default 1`;
- `aanvulling_op_batch_id uuid null`;
- `aangemaakt_door uuid null`;
- `created_at timestamptz not null`;
- `heropend_op timestamptz null`;
- `printdatum timestamptz null`;
- `verzenddatum timestamptz null`;
- `geannuleerd_op timestamptz null`;
- `annuleringsreden text null`.

Statuswaarden:

- `concept`;
- `documenten_gegenereerd`;
- `geprint`;
- `gedeeltelijk_gepost`;
- `gepost`;
- `geannuleerd`.

### Tabel `off_market_printbatch_brieven`

Minimaal contract:

- `id uuid primary key`;
- `batch_id uuid not null`;
- `brief_id uuid not null`;
- `brief_versie_id uuid not null`;
- `toegevoegd_door uuid null`;
- `created_at timestamptz not null`;
- `verwijderd_op timestamptz null`;
- `afwijkingsstatus text null`;
- `afwijkingsreden text null`.

Constraints:

- unique actieve koppeling voor `(brief_versie_id)`;
- verwijderen alleen logisch via `verwijderd_op`;
- na printen of posten geen stille wijziging van batchinhoud;
- latere brieven gaan naar een nieuwe aanvullende batch.

## Fase 6 — Batchdocumenten

Nieuwe tabel: `off_market_batchdocumenten`.

Minimaal contract:

- `id uuid primary key`;
- `batch_id uuid not null`;
- `documentversie integer not null`;
- `documenttype text not null`;
- `bestand_referentie text not null`;
- `status text not null`;
- `metadata jsonb not null default '{}'`;
- `aangemaakt_door uuid null`;
- `created_at timestamptz not null`;
- `vervallen_op timestamptz null`.

Documenttypes:

- `brieven_pdf`;
- `adreslabels`;
- `controlelijst`;
- `batchvoorblad`.

Regels:

- iedere regeneratie verhoogt de batchdocumentversie;
- vorige versies blijven bewaard als `vervallen`;
- controlelijst bevat batchnummer in kop en voettekst;
- batchvoorblad bevat batchnummer, documentversie, aantallen en afwijkingen.

## Fase 7 — Audittrail

Bestaande `off_market_brief_events` blijft behouden.

Voorgestelde uitbreiding:

- optioneel `batch_id`;
- optioneel `brief_versie_id`;
- optioneel `batchdocument_id`;
- nieuwe eventtypes voor nummeruitgifte, versiebeheer en batchmutaties.

Belangrijk:

- operationele statusupdates en het bijbehorende audit-event moeten transactioneel worden uitgevoerd;
- bestaande fail-soft logging mag alleen blijven voor niet-kritieke compatibiliteits-events;
- kritieke gebeurtenissen zoals nummeruitgifte, posten en batchvergrendeling mogen niet slagen zonder auditrecord.

## Fase 8 — Dual-read en dual-write

### Dual-read

Tijdens de overgang leest de UI:

1. nieuwe canonieke brief-/batchvelden wanneer aanwezig;
2. anders bestaande velden als compatibiliteitsfallback.

### Dual-write

Alleen voor expliciet gekozen overgangshandelingen:

- nieuwe printactie schrijft nieuwe canonieke status én bestaande compatibiliteitsvelden;
- nieuwe verzendactie schrijft nieuwe canonieke status én bestaande `status`, `verzendstatus`, `postdatum` en `verzonden_op`;
- dual-write stopt pas na bewezen pariteit.

Geen generieke database-trigger die ondoorzichtig alle oude en nieuwe velden synchroniseert, tenzij tests aantonen dat dit noodzakelijk en veilig is.

## Fase 9 — Backfillstrategie

Backfill wordt een afzonderlijke, herhaalbare en idempotente operatie.

Volgorde:

1. alleen classificeren en rapporteren;
2. aantallen en uitzonderingen controleren;
3. automatisch migreerbare records voorzien van dossierkoppeling;
4. alleen niet-verzonden actieve brieven optioneel van nummer voorzien;
5. historische verstuurde brieven uitsluitend na expliciete regel en controle;
6. uitzonderingen in een beoordelingslijst laten staan.

Iedere backfill schrijft:

- run-ID;
- aantal bekeken records;
- aantal gewijzigd;
- aantal overgeslagen;
- reden per uitzondering;
- voor/na-integriteitscontrole.

## Fase 10 — RLS-ontwerp

Per nieuwe tabel minimaal:

- RLS enabled;
- lezen uitsluitend voor geautoriseerde CRM-gebruikers;
- creëren en wijzigen uitsluitend voor passende CRM-rollen;
- geen hard delete voor applicatierollen;
- verzonden snapshots, nummerreeksen en auditrecords niet direct wijzigbaar;
- nummerfuncties controleren rol en authenticatie opnieuw in de database.

RLS-tests moeten aantonen:

- toegestane gebruiker kan lezen en geldige acties uitvoeren;
- onbevoegde gebruiker kan niet lezen of muteren;
- client kan tellerstructuur niet direct aanpassen;
- geprinte/geposte batch kan niet via generieke update worden teruggezet naar concept;
- verzonden briefversie kan niet inhoudelijk worden gewijzigd.

## Fase 11 — Validatie en pariteit

Vóór activatie minimaal:

- unieke nummerconstraints groen;
- concurrencytest voor brief- en batchnummering;
- één actieve briefversie per brief;
- geen briefversie in twee actieve batches;
- telling `Acquisitieselectie (x)` gelijk aan `Nieuwe selectie`;
- printdatum en verzenddatum aantoonbaar onafhankelijk;
- bestaande schermen blijven laden;
- bestaande 9 baselinefouten worden onderscheiden van nieuwe regressies;
- typecheck groen;
- production build groen;
- Vercel-preview groen;
- RLS- en migratietests groen.

## Rollbackstrategie

Omdat de eerste stappen additief zijn:

- featureflags of UI-routing kunnen worden teruggezet naar bestaande flow;
- nieuwe tabellen en velden blijven ongebruikt staan wanneer activatie wordt teruggedraaid;
- geen automatische drop in productie;
- geen rollback die uitgegeven nummers hergebruikt;
- reeds verzonden snapshots blijven behouden;
- dual-write kan worden gestopt zonder historische gegevens te verwijderen.

## Activatiebesluit

Productieactivatie vereist een afzonderlijk expliciet akkoord nadat is gerapporteerd:

- exacte migraties;
- exacte RLS-policies;
- resultaten van schema-, integriteits-, concurrency- en pariteitstests;
- backfillrapport;
- lijst met handmatige uitzonderingen;
- rollbackpad;
- bevestiging dat geen Kadasterautomatisering of ongewenste productie-integratie is toegevoegd.
