# Off-Market Radar — provider-onafhankelijke AI-laag

## Doel
De Radar mag niet afhankelijk zijn van één AI-provider. De businesslogica (prompt, scoring, cache, audit, databasewrites) blijft provider-onafhankelijk; alleen de transportlaag wisselt.

Ondersteunde providers:

- `openai` — OpenAI API
- `anthropic` — Claude API
- `gemini` — Google Gemini API

## Configuratie

Runtime-only secrets/config:

- `AI_PROVIDER=openai|anthropic|gemini`
- `AI_DEFAULT_MODEL` (optioneel generiek modeloverride)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `OPENAI_DEFAULT_MODEL` (optioneel)
- `ANTHROPIC_DEFAULT_MODEL` (optioneel)
- `GEMINI_DEFAULT_MODEL` (optioneel)
- `AI_INPUT_USD_PER_MILLION`
- `AI_OUTPUT_USD_PER_MILLION`

Secrets worden nooit naar GitHub of database-export geschreven.

## Uniform outputcontract
Elke provider moet dezelfde `score_signaal` tool uitvoeren. De provideradapter retourneert:

- provider
- model
- gestructureerde output
- inputtokens
- outputtokens
- provider request-id indien beschikbaar

Hierdoor kunnen cache, audit, kostenregistratie en scoring boven de providerlaag gelijk blijven.

## Kostenbewaking
Prijzen worden niet hardcoded in broncode omdat modelprijzen kunnen wijzigen. Kosten worden berekend met configureerbare tarieven per miljoen input- en outputtokens.

Vervolgtranche voegt harde guards toe vóór een betaalde call:

1. dagbudget;
2. maandbudget;
3. maximaal aantal AI-runs per dag;
4. fail-closed wanneer budgetconfiguratie ontbreekt of is overschreden;
5. audit van provider/model/tokens/kosten per run.

## Activatievolgorde

1. provideradapter + tests op main;
2. bestaande `off-market-enrich-signaal` koppelen aan adapter zonder automatische triggers;
3. één handmatig testsignaal per gekozen provider;
4. outputpariteit en kostenregistratie controleren;
5. budgetguards activeren;
6. pas daarna automatische AI-trigger inschakelen voor geselecteerde signalen.

## Veiligheidsgrenzen

- Kadaster blijft volledig handmatig.
- GEO/PDOK staat los van AI en mag automatisch blijven draaien.
- Geen providerfallback die onverwacht kosten kan veroorzaken; fallback moet later expliciet configureerbaar zijn.
- Ontbrekende API-key = fail-closed.
- Geen historische AI-resultaten herschrijven enkel vanwege providerwissel.
