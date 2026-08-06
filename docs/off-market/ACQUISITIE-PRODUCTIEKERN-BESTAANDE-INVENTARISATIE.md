# PLAN A — Inventarisatie bestaande acquisitieproductiecontracten

## Doel

Deze inventarisatie legt vast welke bestaande CRM-onderdelen BUILD A moet uitbreiden zonder de huidige dagelijkse brieven- en opvolgingsflow te breken.

Deze inventarisatie is repository-gebaseerd. Zij wijzigt geen database, Supabase-project, productiegegevens of runtimeconfiguratie.

## 1. Bestaande acquisitieselectie

### Tabel `off_market_acquisitie_selectie`

Bestaande gegevens:

- `id`;
- `signaal_id`;
- `toegevoegd_door`;
- `toegevoegd_op`;
- `notitie`;
- `archived_at`.

Bestaand gedrag:

- actieve selectie wordt bepaald door `archived_at IS NULL`;
- verwijderen uit de selectie is soft-remove;
- opnieuw toevoegen heractiveert een bestaande rij;
- de selectie is primair gekoppeld aan een signaal, niet aan een zelfstandig acquisitiedossier.

### Consequentie voor BUILD A

De bestaande selectierij blijft het instappunt en mag niet worden vervangen zonder compatibiliteitslaag. Voor de operationele productiekern zijn aanvullende dossiergegevens nodig, minimaal:

- `verwerking_gestart_op`;
- `verwerking_gestart_door`;
- primaire operationele werkbak;
- actuele volgende actie en datum;
- optionele koppeling met centraal `object_id`.

Voorkeursrichting voor de schemareview:

1. selectie uitbreiden tot lichtgewicht acquisitiedossier; of
2. een afzonderlijk `off_market_acquisitie_dossiers`-object toevoegen met één actieve dossierkoppeling per selectie/signaal.

Een keuze wordt pas definitief na controle van bestaande unieke indexen, policies en querypatronen.

## 2. Bestaande briefopslag

### Tabel `off_market_brieven`

Het bestaande briefrecord combineert momenteel identiteit, inhoud, geadresseerde, productie- en opvolgingsstatus.

Bekende velden uit het actuele TypeScript-contract:

- `id`;
- `signaal_id`;
- `eigenaar_naam`;
- `eigenaar_bedrijfsnaam`;
- `verzendadres`;
- `objectadres`;
- `objectomschrijving`;
- `aanhef`;
- `onderwerp`;
- `brieftekst`;
- `status` (`concept` of `verstuurd`);
- `verzonden_op`;
- `aangemaakt_door`;
- `created_at`;
- `updated_at`;
- `archived_at`;
- `archived_reason`;
- `kanaal`;
- `campagne_stap`;
- `geadresseerde_key`;
- `printdatum`;
- `postdatum`;
- `verzendstatus`;
- `opvolgdatum`;
- `gekoppelde_taak_id`;
- responsvelden.

### Bestaand gedrag

- concepten worden aangemaakt en inhoudelijk bijgewerkt via één record;
- een bestaand verstuurd record wordt niet door een gewone inhoudelijke upsert teruggezet naar concept;
- markeren als verstuurd is idempotent op `status = verstuurd`;
- postdatum, verzendstatus, verzonden tijdstip en opvolgdatum worden gezamenlijk bijgewerkt;
- na verzending kan automatisch een opvolgdatum ontstaan;
- een gekoppelde taak kan aan de brief worden opgeslagen;
- de signaalstatus kan fail-soft naar `benaderd` worden gepromoveerd;
- gearchiveerde brieven worden standaard uitgefilterd;
- verstuurde brieven horen volgens het bestaande contract niet te worden gearchiveerd.

### Risico's voor BUILD A

Het bestaande record is niet geschikt om zonder aanvullende structuur alle nieuwe garanties te leveren:

- geen onveranderlijk briefnummer;
- geen afzonderlijke immutabele briefversies;
- geadresseerdegegevens zijn geen expliciet versiegebonden snapshot;
- inhoud en productie-/verzendstatus zitten op hetzelfde muteerbare record;
- geen expliciete batchkoppeling;
- geen databasegarantie dat één briefversie slechts in één actieve batch zit;
- print- en verzendregistratie zijn wel onderscheiden, maar de huidige verstuurd-mutatie werkt meerdere velden tegelijk bij;
- auditlogging is fail-soft en daarom geen afdwingbare transactionele audittrail.

## 3. Bestaande geadresseerde-identiteit

De huidige flow gebruikt `geadresseerde_key` om brieven per geadresseerde te groeperen en duplicaten te beperken.

Huidige brongegevens zijn onder andere:

- eigenaarnaam;
- bedrijfsnaam;
- verzendadres;
- gegenereerde sleutel.

### Consequentie voor BUILD A

`geadresseerde_key` blijft tijdens de overgang nodig voor backwards compatibility, maar mag niet de enige historische identiteit zijn.

BUILD A heeft per briefversie een onveranderlijke geadresseerde-snapshot nodig, bijvoorbeeld als gestructureerde velden of gevalideerde JSON:

- naam;
- bedrijfsnaam;
- aanhef;
- straat en huisnummer;
- postcode;
- plaats;
- land;
- bron/verificatiestatus;
- optionele `relatie_id`.

Een latere wijziging van de centrale relatie mag een reeds gegenereerde of verzonden snapshot niet aanpassen.

## 4. Bestaande print- en verzendstatus

Relevante bestaande velden:

- `printdatum`;
- `postdatum`;
- `verzonden_op`;
- `verzendstatus`;
- `status`;
- `kanaal`.

Bestaande waarden en interpretaties omvatten onder andere:

- concept;
- geprint;
- in envelop;
- gepost;
- verzonden;
- verstuurd.

### Compatibiliteitsregel

BUILD A mag bestaande statusvelden niet onmiddellijk verwijderen of negeren. Tijdens de overgang moet een expliciete adapter bepalen:

- welke oude waarden naar de nieuwe productiestatus mappen;
- welke nieuwe status teruggeschreven moet worden voor bestaande schermen;
- wanneer dual-write tijdelijk nodig is;
- wanneer pariteit bewezen is en de nieuwe velden canoniek mogen worden.

`Geprint` mag nooit automatisch `Gepost` betekenen. Een opvolging mag pas ontstaan na bevestigde verzending.

## 5. Bestaande opvolging

De brief bevat momenteel:

- `opvolgdatum`;
- `gekoppelde_taak_id`;
- responsstatus en responsdatum;
- responskanaal en samenvatting.

Bij markeren als verstuurd wordt een opvolgdatum berekend. Een bestaande taak kan worden gekoppeld en er bestaan audit-events voor het aanmaken en afronden van opvolging.

### Consequentie voor de fasering

BUILD A moet de bestaande opvolgvelden intact houden en alleen de noodzakelijke koppelingen voorbereiden. De volledige opvolgingsherbouw blijft PR B.

BUILD A mag wel garanderen:

- verzending is de voorwaarde voor een opvolging;
- brief en geadresseerde blijven herleidbaar;
- een batchactie kan een voorgestelde opvolgdatum doorgeven;
- bestaande taak-ID's blijven leesbaar.

## 6. Bestaande audittrail

### Tabel `off_market_brief_events`

De huidige auditlaag ondersteunt onder andere:

- `concept_created`;
- `pdf_generated`;
- `printed`;
- `enveloped`;
- `posted`;
- `sent`;
- `response_received`;
- `returned_mail`;
- `follow_up_created`;
- `follow_up_completed`;
- `archived`.

Bekende koppelingen/velden:

- `signaal_id`;
- optioneel `brief_id`;
- `geadresseerde_key`;
- `campagne_stap`;
- `kanaal`;
- eventtype en status;
- metadata;
- gebruiker en tijdstip.

### Kritieke observatie

De huidige logger is bewust fail-soft: een fout in eventlogging blokkeert de primaire gebruikersactie niet.

Dat is bruikbaar als operationeel logboek, maar onvoldoende als enige garantie voor onveranderlijke nummeruitgifte, batchwijzigingen en verzonden snapshots.

### Richting voor BUILD A

- bestaand eventlog behouden voor UI-historie en backwards compatibility;
- kritieke productie-events transactioneel of via databasefunctie vastleggen;
- nummeruitgifte en de bijbehorende auditregistratie in dezelfde transactie uitvoeren;
- append-only policies afdwingen voor nieuwe kritieke auditrecords;
- dubbele events door retry/idempotentie voorkomen met operationele sleutel of uniek event-ID.

## 7. Bestaande taken en signaalstatus

Bestaande brieven kunnen aan `taken` zijn gekoppeld via `gekoppelde_taak_id`.

Na verzending kan de bestaande briefhook het signaal fail-soft promoveren naar `benaderd`, mits het signaal nog niet verder in de funnel staat.

### Consequentie

BUILD A mag deze statuspromotie niet dupliceren. Er moet één canonieke overgangsservice of databasefunctie komen die:

- idempotent is;
- bestaande verdere funnelstatussen respecteert;
- geen dubbele audit-events produceert;
- compatibel blijft met de huidige hook totdat de nieuwe flow volledig actief is.

## 8. Voorgesteld compatibiliteitsmodel voor BUILD A

### Behouden

- `off_market_acquisitie_selectie` als bestaande selectiebron;
- `off_market_brieven` als bestaande briefidentiteit tijdens de overgang;
- `geadresseerde_key` voor bestaande groepering;
- bestaande print-, post-, opvolg- en responsvelden;
- `off_market_brief_events` als zichtbaar operationeel logboek;
- bestaande taak- en signaalkoppelingen.

### Toevoegen

- expliciet acquisitiedossier of dossieruitbreiding;
- onveranderlijk briefnummer;
- afzonderlijke briefversietabel;
- versiegebonden geadresseerde-snapshot;
- printbatch;
- batchbriefkoppeling naar één specifieke briefversie;
- batchdocumenten en documentversies;
- atomische nummerreeksen/databasefuncties;
- kritieke append-only productieaudit;
- genormaliseerde zoekvelden/indexen.

### Niet direct doen

- bestaande briefrecords hard migreren of verwijderen;
- verzonden historische brieven automatisch een fictief nummer geven;
- bestaande opvolgtaken opnieuw aanmaken;
- alle oude velden in één release vervangen;
- productiegegevens backfillen zonder classificatie- en pariteitsrapport.

## 9. Nog blokkerend te verifiëren vóór BUILD A

Repository-inventarisatie alleen bewijst niet de actuele databaseconfiguratie. Voor de uitvoerings-BUILD moeten nog read-only worden vastgesteld:

- exacte DDL van de drie bestaande tabellen;
- unieke indexen en constraints;
- actuele RLS-policies;
- grants en databasefuncties;
- bestaande Storage-buckets/paden voor PDF's;
- actuele aantallen actieve, verzonden, gearchiveerde en onvolledige brieven;
- dubbele `geadresseerde_key`-combinaties;
- inconsistenties tussen `status`, `verzendstatus`, `printdatum`, `postdatum` en `verzonden_op`;
- verweesde taak-, signaal- of briefkoppelingen;
- welke bestaande brieven veilig automatisch migreerbaar zijn.

Deze controles zijn read-only. Geen migratie, backfill of statuswijziging mag plaatsvinden als onderdeel van de inventarisatie.

## 10. Voorlopige ontwerpbeslissing

Op basis van het bestaande contract is de veiligste richting:

1. bestaande brief als duurzame briefidentiteit uitbreiden met een onveranderlijk briefnummer;
2. nieuwe immutabele `briefversies` naast de bestaande inhoud toevoegen;
3. bestaande velden tijdelijk als compatibiliteitsprojectie behouden;
4. batches uitsluitend koppelen aan een specifieke briefversie;
5. kritieke nummer- en batchmutaties via databasefuncties uitvoeren;
6. bestaande UI gefaseerd laten overschakelen nadat pariteitstests groen zijn.

Deze beslissing is voorlopig totdat de actuele DDL, RLS en datakwaliteit read-only zijn gecontroleerd.