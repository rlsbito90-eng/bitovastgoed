# CRM Edge Function migratiekaart

Status: voorbereidende migratie-inventarisatie. Dit document activeert of deployt niets.

## Doel

De CRM-backend wordt later gecontroleerd gemigreerd van de huidige Lovable/Supabase-omgeving naar het eigen Supabase-project. Edge Functions mogen daarbij niet als één pakket blind worden gedeployed. Elke functie krijgt een expliciete classificatie, secrets-check en activatiebesluit.

## Harde grenzen

- Bron/productieproject `ljudxyrqoifhfikueric` blijft tijdens voorbereiding ongewijzigd.
- Doelproject `vyjocdlwfxrblusfngfq` ontvangt geen functions, secrets of activatie zonder aparte goedkeuring en bewijs.
- BAG-project `xfygspvpeugxowxbcvnm` blijft BAG-only.
- `supabase/config.toml` wijst momenteel nog naar `ljudxyrqoifhfikueric`; gebruik daarom geen ongerichte `supabase deploy` vanuit de repository.
- Geen automatische of impliciete Kadasterbestellingen.
- MCP wordt niet meegenomen in de eerste CRM-cutover.

## Runtimebasis

Veel functies gebruiken alleen de door Supabase geleverde runtimewaarden:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` of publishable key
- `SUPABASE_SERVICE_ROLE_KEY`

Deze waarden zijn projectgebonden en worden op het doelproject niet gekopieerd uit de bron. Ze moeten door het doelproject zelf worden geleverd.

## Functieclassificatie

### 1. Off-Market AI — migreren, maar pas na secretconfiguratie

Functie:

- `off-market-enrich-signaal`

Extra configuratie:

- vereist: `GEMINI_API_KEY`
- optioneel: `AI_DEFAULT_MODEL`
- gedeeld met scheduler/BAG-cascade: `OFF_MARKET_CRON_SECRET`

De code gebruikt direct Google Gemini en heeft geen Lovable AI-gatewayfallback meer. JWT/rolcontrole, AI-run-audit, cache en BAG-cascade blijven afzonderlijke veiligheidslagen.

Activatie-eis:

1. schema/tabellen/RPC `is_intern_gebruiker` aanwezig;
2. doel-Auth en rollen bewezen;
3. secret aanwezig;
4. gerichte test met niet-productiesignaal;
5. expliciet akkoord voordat writes worden toegestaan.

### 2. Off-Market scheduler — migreren zonder automatische activatie

Functies:

- `off-market-cron-activate`
- `off-market-sync-scheduler`
- `off-market-import-bekendmakingen`
- `off-market-normalize-ruw`

Extra secret:

- `OFF_MARKET_CRON_SECRET`

`off-market-cron-activate` kan de pg_cron-job aanmaken/vervangen. Daarom mag deze functie wel als code worden voorbereid, maar de activator mag pas worden aangeroepen nadat bronconfiguratie, import- en normalisatiegedrag op het doelproject bewezen zijn.

Migratievolgorde:

1. functies beschikbaar maken zonder cron-activatie;
2. handmatige smoke-test import;
3. handmatige smoke-test normalize;
4. scheduler dry/controlled run;
5. pas daarna afzonderlijk besluiten over `off-market-cron-activate`.

### 3. Off-Market geo/BAG — functioneel scheiden van CRM-database

Functies:

- `off-market-geo-verrijk`
- `off-market-bag-verrijk`

De BAG-database blijft in het aparte BAG-project. Een CRM-migratie mag geen BAG-data of BAG-projectconfiguratie naar `vyjocdlwfxrblusfngfq` kopiëren. Alleen de gecontroleerde cross-project queryroute mag worden hergebruikt wanneer die voor de nieuwe CRM-authcontext bewezen is.

### 4. Kadaster — niet automatisch activeren

Functies:

- `kadaster-objectinformatie`
- `kadaster-pdf-text-extract`
- `off-market-kadaster-check`

Extra configuratie:

- `kadaster-objectinformatie`: `KADASTER_OBJECTINFORMATIE_API_KEY`
- optioneel: `KADASTER_OBJECTINFORMATIE_BASE_URL`
- `off-market-kadaster-check`: optionele `KADASTER_API_KEY`, maar de echte API-adapter is daar momenteel nog niet geïmplementeerd.

`kadaster-objectinformatie` kan betaalde Kadaster-producten opvragen. Migratie van code of historische Kadaster-data is geen toestemming om betaalde calls te activeren. De sleutel, productcatalogus en gebruikersactie moeten apart worden gevalideerd.

### 5. iCal — apart verifiëren

Functie:

- `bito-ical-feed`

Deze functie hoort bij de CRM en kan pas worden overgezet nadat de bijbehorende feed-token/tabellen, RLS en bestaande URL-contracten in het doelproject zijn gecontroleerd.

### 6. MCP — uitsluiten van eerste cutover

Functie:

- `mcp`

Broncode/tooling:

- `src/lib/mcp/**`
- `@lovable.dev/mcp-js`
- Vite MCP-plugin

De huidige gegenereerde MCP Edge Function bevat Lovable MCP-runtimecode en een hardcoded verwijzing naar het oude CRM-project. Daarom geldt:

- niet deployen naar `vyjocdlwfxrblusfngfq`;
- niet gebruiken als bewijs dat de nieuwe Auth-config werkt;
- eerst apart beslissen of MCP behouden, onafhankelijk herschreven of verwijderd wordt.

## Deploystrategie

Gebruik geen bulkdeploy van `supabase/functions` naar het doelproject. Werk per functionele tranche:

1. read-only / lage impact;
2. gewone CRM-functies;
3. AI met eigen secret;
4. scheduler zonder cronactivatie;
5. Kadaster alleen na expliciete toestemming;
6. MCP pas na apart architectuurbesluit.

Voor iedere tranche gelden minimaal:

- doelprojectref expliciet bevestigd;
- vereiste schema/RPC/RLS aanwezig;
- secrets op naam gecontroleerd, nooit waarden loggen of documenteren;
- function invoke gecontroleerd;
- writes/resultaten gereconcilieerd;
- rollbackpad = bronproject intact laten.

## Open blokkades vóór function-deployment naar het eigen CRM

1. Doelschema `vyjocdlwfxrblusfngfq` is nog niet equivalent aan de huidige CRM-productie.
2. Auth-user(s), rollen en social OAuth moeten op het doelproject worden bewezen.
3. Storage en historische data moeten eerst gecontroleerd worden gekopieerd en gereconcilieerd.
4. `supabase/config.toml` wijst nog naar de huidige bronproductie.
5. Vercel Preview/Production mogen pas naar het doelproject wijzen nadat de backendmigratie zelf groen is.
6. MCP is nog Lovable-afhankelijk en blijft buiten de eerste cutover.

## Resultaatcriterium

Lovable kan pas als backendafhankelijkheid worden beschouwd als verwijderd wanneer minimaal is bewezen dat:

- Vercel de eigen CRM-Supabase gebruikt;
- Auth volledig via het eigen Supabase-project werkt;
- vereiste CRM Edge Functions op het eigen project draaien;
- AI direct via de gekozen provider werkt;
- Storage en databasegegevens compleet zijn;
- geen noodzakelijke CRM-runtime nog `ljudxyrqoifhfikueric` of een Lovable gateway nodig heeft;
- eventuele resterende Lovable tooling expliciet niet-productiekritisch is of apart is verwijderd.
