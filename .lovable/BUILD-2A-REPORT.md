# BUILD-2A — Live read-only validatie datacontracten

Project: `ljudxyrqoifhfikueric` (productie). Alleen `SELECT` en `EXPLAIN` uitgevoerd. Geen schema-, rol-, view-, grant-, RLS- of datawijzigingen.

---

## 1. Live bevestigd schema

### 1.1 Enums

**`public.off_market_status`** (15 waarden, exact zoals in code):
`nieuw_signaal, te_onderzoeken, eigenaar_achterhalen, benaderen, in_gesprek, object_ontvangen, dealtraject, niet_interessant, archief, interessant, twijfel, eigenaar_gevonden, benaderd, aanbod_ontvangen, afgevallen`.

**`public.taak_status`** (5 waarden):
`open, in_uitvoering, afgerond, wacht_op_reactie, geannuleerd`.

### 1.2 Kolommen (samengevat, alleen tool-relevante velden)

| Tabel | Kolommen (kern) |
|---|---|
| `off_market_signalen` (102) | `id, titel, plaats, provincie, regio, assettype, status, prioriteit, ai_score, ai_score_componenten (jsonb), ai_status, ai_samenvatting, ai_aanbevolen_actie, potentiele_strategie, indicatieve_waarde, mogelijke_fee, volgende_actie_datum, volgende_actie_omschrijving, eigenaarstatus, eigenaar_relatie_id, gekoppeld_object_id, gekoppelde_deal_id, gearchiveerd_op, archief_reden, created_at, updated_at` |
| `off_market_brieven` (29) | `id, signaal_id, kanaal (text NOT NULL), campagne_stap (text NULL), verzendstatus (text NOT NULL), status (text NOT NULL), postdatum, printdatum, verzonden_op, opvolgdatum, gekoppelde_taak_id, responsstatus, responsdatum, respons_kanaal, geadresseerde_key, archived_at` |
| `off_market_brief_events` (12) | `signaal_id, brief_id, event_type (text), event_date, campagne_stap, kanaal, status, metadata (jsonb)` |
| `taken` (17) | `id, titel, type_taak (text), status, prioriteit, deadline, off_market_signaal_id, soft_deleted_at` |
| `contact_moments` (21) | `moment_date, type (enum), direction (enum), title, outcome (text), follow_up_required, follow_up_date, off_market_signaal_id, is_system` |

### 1.3 Foreign keys (alleen tool-relevant)

- `off_market_brieven.signaal_id → off_market_signalen(id)` (CASCADE)
- `off_market_brieven.gekoppelde_taak_id → taken(id)` (SET NULL)
- `off_market_brief_events.signaal_id → off_market_signalen(id)` (CASCADE)
- `off_market_brief_events.brief_id → off_market_brieven(id)` (CASCADE)
- `taken.off_market_signaal_id → off_market_signalen(id)` (SET NULL)
- `contact_moments.off_market_signaal_id → off_market_signalen(id)` (SET NULL)

### 1.4 Indexen (bruikbaar voor tools)

`off_market_signalen`: `status`, `provincie`, `assettype`, `prioriteit`, `ai_score DESC NULLS LAST`, `(ai_status, ai_score)`, `created_at DESC`, `volgende_actie_datum` (partial), `geo_gemeente_code`, `geo_wijk_code`, `geo_buurt_code`, GIN op `search_tsv`.
`off_market_brieven`: `(signaal_id)`, `(signaal_id, geadresseerde_key)`, `(signaal_id, opvolgdatum)`, partial op actieve records.
`off_market_brief_events`: `(brief_id, event_date DESC)`, `(signaal_id, event_date DESC)`.
`taken`: `status`, `deadline`, partial `(off_market_signaal_id)`.
`contact_moments`: partial `(off_market_signaal_id)`, `(moment_date DESC, created_at DESC)`.

### 1.5 RLS + grants

Alle vijf tabellen: `SELECT/INSERT/UPDATE/DELETE` policies scoped op `is_intern_gebruiker(auth.uid())` voor rol `authenticated`. Tabel-ACL toont brede rechten aan `anon`, `authenticated`, `service_role` (RLS blokkeert de daadwerkelijke toegang voor anon).

### 1.6 Triggers

Alleen `BEFORE UPDATE` triggers voor `updated_at` op vier van de vijf tabellen. Geen business-triggers die tool-uitkomsten beïnvloeden.

---

## 2. Afwijkingen van BUILD-1

| # | BUILD-1-aanname | Werkelijkheid | Impact |
|---|---|---|---|
| 1 | Off-market status heeft ~11 waarden | 15 waarden actief in enum | Actieve-set-filter moet expliciet 5 eindstatussen uitsluiten: `archief, afgevallen, niet_interessant, object_ontvangen, dealtraject` |
| 2 | `campagne_stap` volledig gevuld | 30 van 60 brieven hebben `campagne_stap IS NULL` (50%); van de 34 `verstuurd` heeft 26% geen `campagne_stap` | Batchmeting op alleen `campagne_stap` sluit ~9 historische verzonden brieven uit |
| 3 | `responsstatus` structureel bijgehouden | 33/34 verzonden brieven hebben `responsstatus IS NULL` | Respons-KPI is nu vrijwel volledig blind — enige signaal komt uit `brief_events.event_type='response_received'` (1 record) |
| 4 | `verzonden_op` = canonieke verzenddatum | 9 verzonden brieven hebben `verzendstatus='concept'` en geen `postdatum`; verzenddatum moet als `COALESCE(postdatum, verzonden_op::date)` afgeleid worden | Batchperiode-filter moet coalesce gebruiken |
| 5 | `type_taak` is een enum | Vrije tekst met 10+ waarden (`Follow-up`, `Algemeen`, `Bellen`, ...) | Groepering op taaktype alleen als string-histogram, niet als enum |
| 6 | `contact_moments.type` breed bruikbaar | Enum met 10 waarden aanwezig; `outcome` is vrije tekst (91/101 NULL) | Conversieproxy via `contact_moments.type IN ('bod_ontvangen','bod_uitgebracht')` is bruikbaar; `outcome` niet |

---

## 3. Actuele enums en vrije-tekst-waardesets (met counts)

| Veld | Waarden (count) |
|---|---|
| `brieven.campagne_stap` | `NULL:30, brief_1:25, email_1:5` |
| `brieven.kanaal` | `post:55, email:5` |
| `brieven.verzendstatus` | `concept:30, gepost:20, verzonden:5, geprint:4, pdf_gegenereerd:1` |
| `brieven.status` | `verstuurd:34, concept:26` |
| `brieven.responsstatus` | `NULL:59, wil_meer_informatie:1` |
| `brieven.respons_kanaal` | `NULL:59, whatsapp:1` |
| `brief_events.event_type` | `printed:40, posted:36, concept_created:35, follow_up_created:31, sent:9, pdf_generated:6, response_received:1` |
| `brief_events.kanaal` | `post:129, email:28, whatsapp:1` |
| `brief_events.status` | `geprint:40, concept:35, NULL:31, gepost:23, benaderd:14, verzonden:9, pdf_gegenereerd:5, wil_meer_informatie:1` |
| `taken.status` | `open:49, afgerond:30` (rest ongebruikt) |
| `taken.type_taak` | Vrije tekst: `Follow-up:35, Algemeen:18, Bellen:9, Opvolging:8, E-mailen:4, ...` |
| `contact_moments.type` | `notitie:31, bod_ontvangen:25, whatsapp:13, email:13, telefoon:13, linkedin:2, bod_uitgebracht:1, document_gedeeld:1, algemeen:1, teaser_verstuurd:1` |
| `contact_moments.direction` | `n_v_t:62, uitgaand:28, inkomend:11` |
| `contact_moments.outcome` | `NULL:91, gevuld:10` (vrije tekst) |

---

## 4. Batchidentiteitsadvies

Feitelijk vastgesteld:
- Unieke waarden `campagne_stap`: **2** (`brief_1`, `email_1`).
- `campagne_stap` correleert 1-op-1 met `kanaal` (`brief_1↔post`, `email_1↔email`) — geen extra informatiewinst uit `+kanaal`.
- Dekking op verstuurde brieven: **73,5%**. **9 verstuurde brieven** hebben `campagne_stap = NULL` (allen kanaal=post, `verzendstatus IN (concept, pdf_gegenereerd)` met `status=verstuurd` — inconsistent).
- Meerdere verzenddagen per stap (`brief_1`: 2 dagen; `email_1`: 4 dagen).

**Aanbevolen batchidentiteit:** `(campagne_stap, kanaal)` als primaire batchkey. Verzenddatum **niet** in de key opnemen; wel als afgeleide `min/max(COALESCE(postdatum, verzonden_op::date))` per batch tonen. Brieven met `campagne_stap IS NULL` in een aparte bucket `<zonder_batch>` tellen, niet negeren. De ~30 historische brieven (`campagne_stap='brief_1'`) zijn zo betrouwbaar herkenbaar zonder persoonsgegevens.

---

## 5. Datadekkingsmatrix (actieve signalen, N=703)

| Metriek | Aantal | % |
|---|---:|---:|
| Met `ai_score` | 702 | 99,9% |
| Zonder `ai_score` | 1 | 0,1% |
| Actief zonder `volgende_actie_datum` | 692 | 98,4% |
| Actief zonder `volgende_actie_omschrijving` | 693 | 98,6% |
| Actief zonder open taak (696 actieve, excl. eindstatussen) | 671 | 96,4% |
| Signalen met ≥1 contactmoment | 24 | 3,4% |

**Verstuurde brieven (N=34):**
- Zonder `opvolgdatum`: 9 (26%)
- Zonder `gekoppelde_taak_id`: 9 (26%)
- Zonder `responsstatus`: 33 (97%)
- Zonder `campagne_stap`: 9 (26%)

**Conclusie:** de gestructureerde velden `volgende_actie_datum`, `volgende_actie_omschrijving` en `responsstatus` zijn in productie vrijwel niet gebruikt. Follow-up-signaal komt bijna volledig uit **`taken` (status=open, off_market_signaal_id NOT NULL)** en uit `brieven.opvolgdatum`.

---

## 6. Meetbaarheid commerciële uitkomsten

| Uitkomst | Rechtstreeks | Statusproxy | Alleen vrije tekst | Niet meetbaar |
|---|---|---|---|---|
| Signaal geopend/actief | `off_market_signalen.status` + `gearchiveerd_op IS NULL` | | | |
| Eigenaar benaderd | | `status IN ('benaderd','in_gesprek')` + `eigenaarstatus='benaderd'` | | |
| Interesse eigenaar | `brief_events.event_type='response_received'` (1 record) | `status='in_gesprek'`, `brieven.responsstatus IN ('wil_meer_informatie','interesse','gesprek_gepland')` (1 record) | | |
| Bod ontvangen | `contact_moments.type='bod_ontvangen'` (25 records) | `off_market_signalen.status='aanbod_ontvangen'` | Bod-hoogte staat mogelijk in `outcome`/`description` (vrij) | |
| Object ontvangen | `off_market_signalen.status='object_ontvangen'` + `gekoppeld_object_id NOT NULL` | | | |
| Dealtraject / deal-waarde | `status='dealtraject'` + `gekoppelde_deal_id` | | | Feebedrag per deal alleen via `deals`-tabel (buiten scope 1a) |
| Afgevallen / niet interessant | `status IN ('afgevallen','niet_interessant')` + `archief_reden` (vrij) | | Reden vaak in vrije tekst | |
| Retour / verkeerd adres | | `brieven.responsstatus` (nauwelijks gevuld) of `brief_events.event_type='returned_mail'` (0 records) | | Nu praktisch niet meetbaar |

**Bevestigd:** `updated_at` mag **niet** als conversiedatum gebruikt worden — de `BEFORE UPDATE` trigger update `updated_at` bij elke wijziging (o.a. AI-verrijking, geo-verrijking, BAG-verrijking, notitie-edit). Als conversiedatum gebruiken we per uitkomst:
- Bod: `contact_moments.moment_date` waar `type IN ('bod_ontvangen','bod_uitgebracht')`.
- Object ontvangen / deal: geen dedicated timestamp beschikbaar → alleen “huidige status” meetbaar, niet “wanneer bereikt”.
- Respons: `brieven.responsdatum` of `brief_events.event_date` waar `event_type='response_received'`.

**Gap voor BUILD-1b:** wanneer aantoonbaar meetbare conversiedatums per statusovergang gewenst zijn, is een statushistorie- of eventtabel nodig. **Niet** in scope 1a.

---

## 7. Queryplan­bevindingen (EXPLAIN, zonder ANALYZE)

| Tool | Plan | Kosten | Full scan? | Bruikbare indexen |
|---|---|---:|---|---|
| `search_off_market_signals` | Index Scan `idx_off_market_signalen_ai_score` + Incremental Sort | 5,7–28,5 | Nee | ai_score, provincie, assettype (partial filters) |
| `get_off_market_follow_up_queue` | Index Scan `idx_off_market_signalen_ai_score` | 0,2–36,5 | Nee | Bestaande partial op `volgende_actie_datum` niet gekozen door planner — acceptabel bij LIMIT 100 |
| `get_off_market_batch_performance` | Seq Scan op `off_market_brieven` | 26 | Ja | Tabel is klein (60 rijen); seq scan is optimaal — **geen index nodig** |
| `get_off_market_ai_conversion_analysis` | Seq Scan + HashAggregate | 221–222 | Ja | 703 rijen; seq scan is goedkoper dan index → **geen index nodig** |
| `get_off_market_signal` | Niet apart getest; PK-lookup via `off_market_signalen_pkey` is O(1) | | Nee | pkey volstaat |

Geen mismatches met bestaande indexen. Geen nieuwe indexen vereist voor de vijf tools op de huidige datavolumes.

---

## 8. Benodigde nieuwe indexen (voorstel — niet aangemaakt)

Op basis van huidige volumes: **geen**.
Optioneel voor toekomstige schaal (>10k signalen / >5k brieven):
- `off_market_brieven((COALESCE(postdatum, verzonden_op::date)), campagne_stap, kanaal)` — batch-tijdsvenster.
- `off_market_signalen(status, ai_score DESC NULLS LAST) WHERE gearchiveerd_op IS NULL` — actieve-set-scan.

Alleen voorstel; niet gecreëerd.

---

## 9. Aangepaste conceptsignatures — vijf read-only functies

Alle vijf blijven `SECURITY DEFINER STABLE`, gedefinieerd in nieuw schema `ai_gateway_readonly` (BUILD-3), aangeroepen door DB-rol `ai_gateway_reader` zonder RLS-context. Geen wijziging in productiedata.

```sql
-- 1
search_off_market_signals(
  p_query text default null,
  p_provincie text default null,
  p_plaats text default null,
  p_assettype off_market_assettype default null,
  p_status_in off_market_status[] default null,
  p_min_ai_score int default null,
  p_actief_only boolean default true,
  p_limit int default 50,     -- max 100
  p_offset int default 0
) returns table (
  id uuid, titel text, plaats text, provincie text,
  assettype off_market_assettype, status off_market_status,
  prioriteit off_market_prioriteit, ai_score int,
  ai_samenvatting text, potentiele_strategie text,
  volgende_actie_datum date, created_at timestamptz
);

-- 2
get_off_market_signal(p_id uuid) returns table (
  id uuid, titel text, plaats text, provincie text, regio text,
  assettype off_market_assettype, status off_market_status,
  prioriteit off_market_prioriteit, eigenaarstatus off_market_eigenaarstatus,
  ai_score int, ai_score_componenten jsonb, ai_samenvatting text,
  ai_aanbevolen_actie text, potentiele_strategie text,
  indicatieve_waarde numeric, mogelijke_fee numeric,
  volgende_actie_datum date, volgende_actie_omschrijving text,
  heeft_open_taak boolean, aantal_contactmomenten int,
  aantal_verstuurde_brieven int, laatste_brief_kanaal text,
  laatste_brief_campagne_stap text, laatste_respons_status text,
  created_at timestamptz, updated_at timestamptz
);
-- LET OP: geen eigenaar_naam / eigenaar_email / eigenaar_telefoon / adres / postcode.

-- 3
get_off_market_follow_up_queue(
  p_provincie text default null,
  p_assettype off_market_assettype default null,
  p_limit int default 50      -- max 100
) returns table (
  signaal_id uuid, titel text, plaats text, provincie text,
  status off_market_status, ai_score int,
  reden text,                 -- 'geen_open_taak' | 'actie_datum_verstreken' | 'brief_opvolgdatum_verstreken' | 'zonder_actie_datum'
  volgende_actie_datum date, aantal_open_taken int,
  laatste_contactmoment_op date, oudste_openstaande_opvolgdatum date
);

-- 4
get_off_market_batch_performance(
  p_weken_terug int default 26   -- max 52
) returns table (
  campagne_stap text,          -- kan NULL zijn -> label '<zonder_batch>'
  kanaal text,
  eerste_verzenddatum date, laatste_verzenddatum date,
  aantal_brieven int,
  aantal_verzonden int,        -- verzendstatus in ('gepost','verzonden')
  aantal_met_taak int,
  aantal_met_respons int,
  aantal_positieve_respons int,-- brieven.responsstatus in ('interesse','wil_meer_informatie','gesprek_gepland')
  conversie_naar_gesprek numeric  -- pct signalen achter deze batch met status='in_gesprek'
);

-- 5
get_off_market_ai_conversion_analysis(
  p_buckets int default 4      -- 4 vaste ai_score-buckets
) returns table (
  ai_score_bucket text,        -- '0-24','25-49','50-74','75-100'
  aantal int,
  in_gesprek int, aanbod_ontvangen int, object_ontvangen int,
  dealtraject int, afgevallen int, niet_interessant int,
  conversie_gesprek_pct numeric, conversie_object_pct numeric
);
```

Wijzigingen t.o.v. BUILD-1: expliciete NULL-batch-bucket in tool 4; drop van niet-meetbare “fee-per-batch” (fees ontbreken op brieven/signalen); tool 3 met expliciete `reden` in plaats van dichte join op `contact_moments`.

---

## 10. Securityrisico's

- **`SECURITY DEFINER` zonder RLS-context**: functies zullen als owner draaien; noodzakelijk om `is_intern_gebruiker`-policy te omzeilen. Risico beperkt tot exact de kolommen in de RETURN TABLE — daarom staat er in de functies **geen** `SELECT *`. Elke uitbreiding moet expliciet.
- **`ai_gateway_reader`-rol** krijgt uitsluitend `EXECUTE` op de vijf functies en `USAGE` op schema — geen `SELECT` op onderliggende tabellen. Nog niet aangemaakt.
- Vrije-tekst-velden (`notities`, `omschrijving`, `archief_reden`, `respons_samenvatting`, `contact_moments.description/outcome`) worden **niet** teruggegeven. Bevestigd in signature-lijst.
- `search_tsv` mag gebruikt worden voor `p_query`, maar de tekstinhoud zelf blijft binnen de functie.

## 11. Privacyrisico's

- Naam/adres/postcode/e-mail/telefoon/KVK/LinkedIn van eigenaar zijn **niet** in de vijf return-signatures. Alleen `plaats`, `provincie`, `regio` (grofmazig).
- `aantal_contactmomenten` en `laatste_contactmoment_op` zijn agregaat/datum — geen inhoud.
- Batchtool geeft alleen tellingen en datumranges, geen individuele adressen.
- Follow-up-queue geeft `titel` terug; huidige productie-`titel` kan straatnaam bevatten. **Aanbeveling:** in BUILD-3 een `titel_geanonimiseerd` afgeleid veld toevoegen (bijv. eerste 40 tekens tot huisnummer strippen), of `titel` vervangen door `plaats + assettype + korte descriptor`. Beslissing meenemen naar BUILD-2B.

---

## 12. Voorstel BUILD-2B (uitsluitend ontwerp, geen uitvoering)

Doel: definitieve, ondertekende SQL-specs klaarleggen zodat BUILD-3 (productiemigratie) een pure copy-paste is.

BUILD-2B levert op:
1. Volledige DDL-tekst (nog niet uitgevoerd) voor:
   - `CREATE SCHEMA ai_gateway_readonly`;
   - `CREATE ROLE ai_gateway_reader NOLOGIN`;
   - vijf `CREATE FUNCTION ai_gateway_readonly.<naam>(...) RETURNS TABLE ... LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp`;
   - `REVOKE ALL ... FROM public`; `GRANT USAGE ON SCHEMA` + `GRANT EXECUTE ON FUNCTION` aan `ai_gateway_reader`.
2. Beslissing over `titel`-anonimisering (zie §11).
3. Beslissing hoe `campagne_stap IS NULL`-groep gelabeld wordt (`<zonder_batch>` vs. weglaten).
4. Testplan: 5 × happy-path SELECT + 3 × edge (leeg resultaat, ongeldige uuid, limit boven cap) — uit te voeren als dry-run tegen een read-replica of transactie met ROLLBACK, niet in BUILD-2B zelf.
5. Hard stop bij eerste van deze condities: RLS-versoepeling nodig, service-role nodig, functie moet muteren, functie moet cross-schema data uit `auth.*`/`storage.*` lezen, aanpassing van bestaande CRM-triggers of -indexen vereist.

BUILD-2B raakt de database niet en creëert geen credentials.

---

## 13. Go/no-go-advies

**Go** voor BUILD-2B onder de volgende harde randvoorwaarden:

- BUILD-2B blijft ontwerp-only (geen migratie, geen role, geen functie, geen grant).
- De vijf signatures uit §9 zijn de definitieve scope; geen 6e tool.
- Anonimisering-beslissing op `titel` wordt in BUILD-2B vastgelegd vóór BUILD-3.
- Respons/conversie-KPI's worden gerapporteerd met de erkende beperking dat `responsstatus` in productie nauwelijks gevuld is (§3, §5) — de tools mogen niet suggereren dat afwezige respons = geen interesse.
- BUILD-3 wordt pas voorgelegd als BUILD-2B is goedgekeurd.

**No-go** op alles daarbuiten: geen index-creatie, geen aanpassing aan bestaande CRM-functies, geen data-backfill van `campagne_stap`, `responsstatus`, `volgende_actie_datum`.

---

*Einde BUILD-2A. Er zijn geen schema-, rol-, view-, functie-, index-, grant-, RLS-, credential- of connectie-wijzigingen uitgevoerd. Uitsluitend `SELECT`- en `EXPLAIN`-query's tegen `ljudxyrqoifhfikueric`.*
