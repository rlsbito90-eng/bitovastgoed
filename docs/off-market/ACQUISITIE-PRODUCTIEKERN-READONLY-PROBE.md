# PLAN A — Read-only databaseprobe

## Doel

Voor BUILD A moet de actuele productie-CRM read-only worden gecontroleerd op DDL, constraints, indexen, RLS, policies en datakwaliteit.

Beoogd Supabase-productieproject volgens de repository-/projectdocumentatie:

`ljudxyrqoifhfikueric`

## Uitgevoerde productieprobe — 8 augustus 2026

De directe Supabase-connector exposeert het beoogde CRM-project niet en is daarom **niet** gebruikt tegen een alternatief project.

Er bleek wel een reeds bestaande, projectgebonden read-only route beschikbaar via Lovable voor:

- Lovable-project: `Bito Vastgoed CRM Project`;
- Lovable project-id: `93b233ce-d620-40ce-aec6-9fb060eaf772`;
- bestaande database-status: enabled, stack `supabase`.

Er is niets geprovisioned, geen credential toegevoegd en geen configuratie gewijzigd.

Alle uitgevoerde databasecommando's waren uitsluitend `SELECT`-queries. De Lovable-tool exposeert de onderliggende Supabase-project-ref niet rechtstreeks; de doelidentiteit is daarom vastgesteld via de bestaande databasebinding van het live Bito Vastgoed CRM-project en gecontroleerd op het verwachte CRM-schema en operationele data.

### Identiteits-/schemacontrole

Aangetroffen in de projectgebonden database:

- `public.off_market_brieven`;
- `public.off_market_acquisitie_selectie`;
- `public.off_market_brief_events`;
- 880 `off_market_signalen`;
- 96 `off_market_brieven`.

Deze productieprobe heeft geen namen, adressen of briefteksten geretourneerd.

## Actuele `off_market_brieven` DDL

De live tabel bevat de legacy-kolommen plus de reeds bestaande mailingvelden (`kanaal`, `campagne_stap`, `geadresseerde_key`, `printdatum`, `postdatum`, `verzendstatus`, `opvolgdatum`, responsvelden enz.).

De live benoemde statusconstraint is:

`off_market_brieven_status_check`

met definitie:

`CHECK (status = ANY (ARRAY['concept'::text, 'verstuurd'::text]))`

De live statusverdeling is:

- `concept`: 27;
- `verstuurd`: 69.

Daarmee is bewezen dat de BUILD-A transactionele functie `off_market_brief_definitief_maken`, die `status = 'definitief'` schrijft, zonder de eerder voorbereide transitieve constraintwijziging zou falen.

De dossier/briefkern-draft is daarom defensief en legacy-compatibel gehouden met de transitieve set:

- `concept`;
- `verstuurd`;
- `definitief`;
- `geannuleerd`.

De draft voert geen backfill uit en eindigt met `ROLLBACK`.

## Actuele indexen

Op `public.off_market_brieven` zijn live onder meer aanwezig:

- `off_market_brieven_pkey`;
- `idx_off_market_brieven_signaal`;
- `idx_off_market_brieven_signaal_geadresseerde`;
- `idx_off_market_brieven_signaal_opvolgdatum`;
- `off_market_brieven_signaal_active_idx` (`WHERE archived_at IS NULL`).

De BUILD-A-draft gebruikt nieuwe, niet-conflicterende indexnamen voor productiekernvelden.

## Actuele RLS en policies

RLS staat live aan op:

- `off_market_acquisitie_selectie`;
- `off_market_brieven`;
- `off_market_brief_events`.

Aangetroffen policies:

### `off_market_acquisitie_selectie`

- SELECT — `Intern leest acquisitieselectie`;
- INSERT — `Intern voegt acquisitieselectie toe`;
- UPDATE — `Intern wijzigt acquisitieselectie`;
- DELETE — `Intern verwijdert acquisitieselectie`.

### `off_market_brieven`

- SELECT — `Interne gebruikers kunnen brieven lezen`;
- INSERT — `Interne gebruikers kunnen brieven aanmaken`;
- UPDATE — `Interne gebruikers kunnen brieven bijwerken`;
- DELETE — `Interne gebruikers kunnen brieven verwijderen`.

### `off_market_brief_events`

- SELECT — `Interne gebruikers lezen briefevents`;
- INSERT — `Interne gebruikers insert briefevents`.

De policies zijn gericht op `authenticated` en gebruiken `public.is_intern_gebruiker(auth.uid())`.

De helper `public.is_intern_gebruiker(_user_id uuid)` is live aanwezig als `SECURITY DEFINER`; execute is aanwezig voor `authenticated` en `service_role` (naast postgres).

## Grants

De bestaande tabellen hebben brede relationele grants voor Supabase-rollen, inclusief `anon`. De feitelijke clienttoegang wordt echter door RLS beperkt: er zijn geen anon-policies op deze drie tabellen.

BUILD A kopieert deze legacy grantstructuur bewust niet naar de nieuwe productiekern. De nieuwe tabellen en functies blijven in de drafts fail-closed via expliciete `REVOKE ALL` voor clientrollen; gerichte grants mogen pas in een afzonderlijk activatiebesluit worden toegevoegd.

## Nieuwe productiekernobjecten zijn nog niet actief

De live database bevat op het moment van de probe **geen** van de volgende BUILD-A-objecten:

- `off_market_productie_nummerreeksen`;
- `off_market_brief_versies`;
- `off_market_printbatches`;
- `off_market_printbatch_brieven`;
- `off_market_batchdocumenten`;
- `off_market_productie_events`;
- `off_market_acquisitie_dossiers`;
- `off_market_brief_definitief_maken(...)`.

Daarmee is bevestigd dat eerdere repository-/CI-werkzaamheden niets in productie hebben geactiveerd.

## Legacy-readgrens

Omdat 69 bestaande rijen status `verstuurd` hebben en historische brieven geen formele productiekern-`selectie_id`/briefversies hebben, worden deze records niet semantisch omgezet naar nieuwe productiekernstatussen.

De productiekern-readrepository behandelt transitief als niet-productiekern:

- een brief met status `verstuurd`;
- een brief zonder formele `selectie_id`.

Deze records blijven via de bestaande CRM-flow beschikbaar. Er vindt geen automatische backfill of statusconversie plaats.

## Geïsoleerd bewijs

Na de legacy-compatibele statusconstraintwijziging is de geïsoleerde PostgreSQL-proof opnieuw groen uitgevoerd. Deze proof dekt:

- alle drie SQL-drafts;
- rollback;
- concurrency;
- idempotentie;
- transactionele postregistratie.

## Veiligheidsresultaat

- Alleen read-only `SELECT` tegen de bestaande Lovable-projectdatabase uitgevoerd.
- Geen productie-DDL uitgevoerd.
- Geen productie-DML uitgevoerd.
- Geen databaseobject gewijzigd.
- Geen credentials/secrets/configuratie gewijzigd.
- Geen Supabase-project aangemaakt of geprovisioned.
- Geen migratie toegepast.
- Geen productiekern geactiveerd.

## Gevolg voor releasepoort

Voor de relevante BUILD-A-basis zijn actuele productie-DDL en actuele RLS/policies nu read-only vastgesteld via de bestaande databasebinding van het live Bito Vastgoed CRM-project.

Dit betekent **niet** dat productie mag worden geactiveerd. De overige releasevoorwaarden blijven afzonderlijk gelden, waaronder:

- definitieve beoordeling van de migratie tegen deze live DDL;
- volledige testsuite en productiebuild;
- E2E dagelijkse workflowacceptatie;
- gecontroleerde migratie-/rollbackprocedure;
- expliciet afzonderlijk productieakkoord.

Geen enkele runtime-activatievlag wordt door dit document gewijzigd.
