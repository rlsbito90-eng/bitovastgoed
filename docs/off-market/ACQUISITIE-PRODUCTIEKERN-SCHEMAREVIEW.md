# Acquisitieproductiekern — schemareview

## Doel

Deze review legt het technische contract vast voor de dagelijkse productieflow:

1. nieuwe selectie;
2. eigenaar achterhalen;
3. brief opstellen;
4. printklaar;
5. geprint / posten;
6. opvolgen;
7. wachten;
8. afgehandeld.

De review introduceert nog geen migraties en wijzigt geen productiegegevens.

## Beslisgrenzen

- Geen hard verwijderen van uitgegeven brief- of batchnummers.
- Geen automatische Kadasterhandelingen.
- Geen afleiding van verzending uit alleen een printdatum.
- Geen opvolging zonder bevestigde verzenddatum.
- Geen dubbele opslag van afleidbare object-, signaal- en relatiekoppelingen in de batch.
- Nummeruitgifte moet atomair zijn en mag geen nummer hergebruiken.

## Kernobjecten

### Acquisitiedossier

Het actieve werkproces rond een geselecteerd signaal.

Verplichte koppelingen:

- `signaal_id`;
- centraal `object_id` zodra beschikbaar;
- `selectie_id`;
- expliciete `verwerking_gestart_op`;
- primaire operationele werkbak;
- actuele volgende actie en datum.

`verwerking_gestart_op` is het canonieke onderscheid tussen `Nieuwe selectie` en de volgende werkbak. Het veld wordt uitsluitend gezet door een expliciete gebruikershandeling zoals `Start verwerking`.

### Brief

Eén concrete brief aan één geadresseerde.

Verplichte gegevens:

- intern UUID;
- onveranderlijk briefnummer, bijvoorbeeld `BR2026000482`;
- versienummer;
- `signaal_id`;
- `acquisitiedossier_id`;
- `object_id` indien beschikbaar;
- optioneel `relatie_id`;
- onveranderlijke geadresseerde-snapshot per versie;
- template en templateversie;
- briefstatus;
- print- en verzendstatus;
- printdatum en verzenddatum afzonderlijk;
- annulering en reden;
- verwijzing naar een vorige brief bij vervolg of vervanging.

Een verzonden versie wordt inhoudelijk vergrendeld. Een correctie na verzending krijgt een nieuw briefnummer.

### Briefversie

Een immutabele documentversie van een brief vóór verzending.

Verplichte gegevens:

- `brief_id`;
- oplopend versienummer;
- inhoudssnapshot;
- geadresseerde-snapshot;
- gegenereerde bestandsreferentie;
- aangemaakt door en op;
- status `actief`, `vervallen` of `verzonden`.

### Printbatch

Een productie-eenheid voor gezamenlijk genereren, printen en posten.

Verplichte gegevens:

- intern UUID;
- onveranderlijk batchnummer, bijvoorbeeld `BAT2026080601`;
- status `concept`, `documenten_gegenereerd`, `geprint`, `gedeeltelijk_gepost`, `gepost` of `geannuleerd`;
- documentversie;
- aangemaakt door en op;
- printdatum;
- verzenddatum;
- optionele relatie met een eerdere batch als aanvulling.

### Batchbrief

Koppelt één specifieke briefversie aan één batch.

Regels:

- een briefversie zit maximaal in één actieve batch;
- toevoegen en verwijderen mag zolang de batch concept is;
- na documentgeneratie vereist wijziging heropenen en regenereren;
- na printen ontstaat voor latere brieven een nieuwe aanvullende batch;
- na posten is de batchinhoud vergrendeld.

### Batchdocument

Versiebeheerd productiedocument.

Types:

- gecombineerde brieven-PDF;
- adreslabels;
- controlelijst;
- batchvoorblad.

Ieder document bevat batchnummer en documentversie. De controlelijst toont het batchnummer in de kop en op iedere pagina in de voettekst.

## Nummering

### Briefnummer

Formaat:

`BR` + viercijferig jaar + zescijferige reeks.

Voorbeeld: `BR2026000482`.

### Batchnummer

Formaat:

`BAT` + datum `YYYYMMDD` + tweecijferige dagreeks.

Voorbeeld: `BAT2026080601`.

### Uitgifte

De database reserveert nummers atomair binnen een transactie. Een uitgegeven of geannuleerd nummer wordt nooit opnieuw gebruikt. Gaten in de reeks zijn toegestaan.

## Werkbakmapping

De primaire werkbak is onderling uitsluitend:

- `nieuwe_selectie`;
- `eigenaar_achterhalen`;
- `brief_opstellen`;
- `printklaar`;
- `geprint_posten`;
- `opvolgen`;
- `wachten`;
- `afgehandeld`.

Overlappende eigenschappen zoals `geblokkeerd`, `geadresseerde_bekend` en `opvolging_verlopen` zijn KPI- of filterkenmerken en geen primaire werkbak.

## Zoekcontract

De CRM-zoekfunctie ondersteunt volledige en gedeeltelijke zoektermen voor:

- briefnummer;
- batchnummer;
- object-ID;
- signaal-ID;
- adres;
- relatienaam;
- geadresseerde-snapshot;
- verzenddatum.

Invoer wordt voor zoeken genormaliseerd naar hoofdletters en alfanumerieke tekens. Daardoor vindt `BR-2026 000482` ook `BR2026000482`.

## Audittrail

Minimaal te registreren events:

- verwerking gestart;
- briefnummer uitgegeven;
- briefversie aangemaakt of vervallen;
- geadresseerde gewijzigd;
- brief geannuleerd;
- batchnummer uitgegeven;
- brief aan batch toegevoegd of verwijderd;
- batch heropend;
- documenten gegenereerd;
- batch geprint;
- brief of batch gepost;
- afwijking, herdruk of gedeeltelijke verzending;
- opvolging aangemaakt.

## Bestaande gegevens

Bestaande brieven krijgen niet automatisch een fictief historisch briefnummer zonder controle. De migratiestrategie moet bestaande actieve brieven classificeren als:

1. veilig automatisch te migreren;
2. handmatige beoordeling nodig;
3. alleen historisch bewaren.

Bestaande print- en verzendvelden blijven tijdens de overgang leesbaar. Nieuwe canonieke velden worden pas leidend nadat pariteitstests aantonen dat bestaande schermen en tellingen gelijk blijven.

## RLS en rechten

- Alleen geautoriseerde CRM-gebruikers mogen brieven en batches lezen.
- Nummeruitgifte verloopt via een beveiligde databasefunctie.
- Alleen geautoriseerde rollen mogen print- of verzendstatus wijzigen.
- Uitgegeven nummers, verzonden snapshots en auditrecords zijn niet hard verwijderbaar vanuit de applicatie.

## Implementatievolgorde

1. inventarisatie bestaande tabellen, velden, policies en hooks;
2. migratieontwerp met rollback- en compatibiliteitsplan;
3. atomische nummerfuncties;
4. brief- en versiecontract;
5. batch- en batchbriefcontract;
6. productiedocumenten;
7. werkbakintegratie;
8. CRM-brede zoekfunctie;
9. print- en verzendregistratie;
10. regressie- en pariteitstests.

## Acceptatiecriteria voor de BUILD

- Geen dubbel brief- of batchnummer mogelijk.
- Eén brief correspondeert met één geadresseerde.
- Historische adressering blijft onveranderd na wijziging van een relatie.
- Printen en posten zijn afzonderlijke gebeurtenissen.
- Een brief kan niet stilzwijgend in twee actieve batches staan.
- Een geprinte of geposte batch kan niet ongemerkt worden gewijzigd.
- Alle belangrijke mutaties staan in de audittrail.
- Bestaande CRM-schermen blijven werken tijdens de overgang.
- Geen productieactivatie zonder groene migratie-, RLS-, type-, build- en regressietests.
