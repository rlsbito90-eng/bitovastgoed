# PLAN A — productie-exportvalidatie 2026-08-06

## Status

Deze validatie is gebaseerd op handmatig geëxporteerde CSV-bestanden uit de Lovable Cloud-productieomgeving. De bestanden zijn uitsluitend lokaal en read-only onderzocht. Er zijn geen productiegegevens gewijzigd en er is geen databaseverbinding gebruikt.

De export bevestigt de aanwezige veldstructuur en actuele gegevensvorm, maar vervangt geen volledige DDL-, index-, foreign-key-, grant- of RLS-inspectie.

## Gevalideerde exports

| Tabel | Rijen | Kolommen |
|---|---:|---:|
| `off_market_signalen` | 874 | 102 |
| `off_market_acquisitie_selectie` | 74 | 6 |
| `off_market_brieven` | 96 | 29 |
| `off_market_brief_events` | 373 | 12 |

Vier aangeleverde exports van `off_market_brief_events` hadden dezelfde omvang en kolomstructuur. Ze worden daarom als één momentopname behandeld.

## Bevestigde bestaande contracten

### `off_market_acquisitie_selectie`

Bevestigde velden:

- `id`
- `signaal_id`
- `toegevoegd_door`
- `toegevoegd_op`
- `notitie`
- `archived_at`

Conclusie:

- de selectie is een dun koppelrecord naar een signaal;
- er bestaat nog geen persistent productie-dossiercontract;
- `verwerking_gestart_op`, expliciete operationele werkbakken en productiestatussen ontbreken in deze export;
- PLAN A moet bestaande records additief uitbreiden of via een nieuw dossierobject koppelen, zonder historische selectiegegevens te overschrijven.

### `off_market_brieven`

Bevestigde velden omvatten:

- identiteit: `id`, `signaal_id`, `geadresseerde_key`;
- geadresseerde: `eigenaar_naam`, `eigenaar_bedrijfsnaam`, `verzendadres`, `aanhef`;
- inhoud: `onderwerp`, `brieftekst`, `objectadres`, `objectomschrijving`;
- lifecycle: `status`, `verzonden_op`, `printdatum`, `postdatum`, `verzendstatus`;
- campagne: `kanaal`, `campagne_stap`;
- opvolging: `opvolgdatum`, `gekoppelde_taak_id`;
- respons: `responsstatus`, `responsdatum`, `respons_kanaal`, `respons_samenvatting`;
- archivering: `archived_at`, `archived_reason`;
- auditdata: `aangemaakt_door`, `created_at`, `updated_at`.

Conclusies:

1. Bestaande brieven bevatten al zowel inhoud als operationele statussen in één record.
2. Printdatum en postdatum zijn afzonderlijk aanwezig en moeten afzonderlijk blijven.
3. Het nieuwe briefversiecontract moet snapshots introduceren zonder bestaande briefinhoud direct te verwijderen of te herschrijven.
4. `geadresseerde_key` is een bestaande compatibiliteitssleutel, maar geen vervanging voor een onveranderlijke geadresseerde-snapshot.
5. Bestaande opvolg- en responsvelden blijven tijdens BUILD A leesbaar; volledige opvolgingsnormalisatie behoort tot PR B.

### `off_market_brief_events`

Bevestigde velden:

- `id`
- `signaal_id`
- `brief_id`
- `geadresseerde_key`
- `campagne_stap`
- `kanaal`
- `event_type`
- `event_date`
- `status`
- `metadata`
- `created_at`
- `created_by`

Conclusies:

- er bestaat al een append-only-achtig gebeurteniscontract voor de huidige brievenflow;
- BUILD A mag deze historie niet vervangen of muteren;
- nieuwe kritieke productie-events moeten koppelbaar blijven via `signaal_id`, `brief_id` en `geadresseerde_key`;
- idempotente transactionele gebeurtenissen kunnen in een afzonderlijk productie-eventcontract worden toegevoegd;
- een compatibiliteitsadapter moet oude en nieuwe events gezamenlijk leesbaar maken.

### `off_market_signalen`

De export bevestigt onder meer bestaande velden voor:

- status en volgende actie;
- eigenaar en eigenaaronderzoek;
- gekoppeld CRM-object;
- BAG- en GEO-context;
- Kadasteradvies en handmatige Kadastercontrole;
- AI-verrijking en deduplicatie.

Conclusies:

- bron-, BAG-, GEO-, AI- en Kadastervelden blijven eigendom van het signaal;
- BUILD A kopieert deze velden niet naar brief- of batchtabellen;
- een acquisitiedossier verwijst naar `signaal_id` en optioneel het bestaande `gekoppeld_object_id`;
- automatische Kadasterhandelingen blijven uitgesloten.

## Aangescherpte migratiestrategie

### Additief en compatibel

1. Bestaande tabellen en kolommen blijven intact tijdens de eerste activatiefase.
2. Nieuwe briefversies krijgen inhouds- en geadresseerde-snapshots.
3. Bestaande `off_market_brieven.id` blijft de primaire compatibiliteitsidentiteit voor oude schermen en historie.
4. Nieuwe briefnummers worden pas definitief uitgegeven bij een transactionele definitiefmaakhandeling.
5. Printbatches koppelen aan een specifieke briefversie; nooit alleen aan een veranderlijk briefrecord.
6. `printdatum` en `postdatum` worden niet uit elkaar afgeleid.
7. Opvolging wordt alleen gestart na expliciete verzend-/postbevestiging.

### Tijdelijke adapterfase

Tijdens de overgang moet de applicatie:

- bestaande brieven blijven lezen;
- nieuwe versie- en batchgegevens optioneel aanvullen;
- oude verzend- en responsvelden blijven tonen;
- verschillen detecteren en rapporteren;
- geen historische records automatisch backfillen zonder afzonderlijk akkoord.

## Nog niet door exports bewezen

De exports bewijzen niet:

- SQL-datatypen en defaults;
- check- en unique-constraints;
- indexes;
- foreign keys en delete-regels;
- exacte RLS-policy-expressies;
- grants per rol;
- databasefuncties, triggers en RPC-contracten;
- Storage-configuratie.

Daarom blijven productie-migratie, RLS-wijziging, backfill en activatie geblokkeerd totdat deze onderdelen afzonderlijk zijn geverifieerd of in een geïsoleerde proef aantoonbaar veilig zijn gemaakt.

## Besluit voor PLAN A

De aangeleverde exports ondersteunen de gekozen additieve architectuur. Er is geen aanleiding om bestaande brief-, selectie- of eventrecords te vervangen. BUILD A moet voortbouwen via nieuwe versie-, batch- en productieauditobjecten plus een expliciete compatibiliteitsadapter.
