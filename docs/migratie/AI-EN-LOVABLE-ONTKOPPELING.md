# AI & Lovable-ontkoppeling

## Doel
De Bito CRM moet zelfstandig kunnen draaien op Vercel + een Supabase-project onder eigen beheer, zonder runtime-afhankelijkheid van Lovable.

## Vastgestelde huidige afhankelijkheden

### 1. Off-Market AI-verrijking
`supabase/functions/off-market-enrich-signaal/index.ts` gebruikte:

- secret `LOVABLE_API_KEY`;
- endpoint `https://ai.gateway.lovable.dev/v1/chat/completions`;
- Lovable-gatewaymodelnaam `google/gemini-3-flash-preview`.

Deze branch vervangt uitsluitend de AI-providerlaag door direct Google Gemini:

- secret `GEMINI_API_KEY`;
- endpoint `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
- standaardmodel via `AI_DEFAULT_MODEL`, fallback `gemini-3.6-flash`;
- oude `google/`-modelprefix wordt bij inkomende modeloverrides verwijderd.

Niet gewijzigd:

- JWT-controle;
- interne-rolcontrole via `is_intern_gebruiker`;
- AI-prompt en scoringsgewichten;
- input-hash/cachecontract;
- writes naar `off_market_signalen`;
- auditregistratie in `off_market_ai_runs`;
- server-side BAG-cascade;
- businessvelden worden niet door AI overschreven.

## 2. Frontend-auth
`src/integrations/lovable/index.ts` gebruikt `@lovable.dev/cloud-auth-js`. Dit is een afzonderlijke runtime-afhankelijkheid en moet vóór volledige Lovable-uitfasering worden vervangen door eigen Supabase Auth/OAuth-configuratie.

Deze branch wijzigt Auth NIET.

## 3. Secretmigratie
Secrets worden nooit via database-export of GitHub gemigreerd. Voor het toekomstige eigen CRM-project moeten minimaal opnieuw worden geconfigureerd:

- `GEMINI_API_KEY`;
- optioneel `AI_DEFAULT_MODEL`;
- bestaande Supabase runtime-secrets die de functie gebruikt (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` worden door Supabase/runtime geleverd volgens deploymentconfiguratie);
- `OFF_MARKET_CRON_SECRET` voor de bestaande interne cascade.

Geen geheime waarden horen in deze repository.

## 4. Migratievolgorde

1. Doelproject onder eigen Supabase-beheer (`vyjocdlwfxrblusfngfq`) schema-/data-equivalent maken.
2. Auth-migratie en OAuth-configuratie bewijzen.
3. Edge Functions inventariseren en uitsluitend benodigde functies naar doelproject deployen.
4. `GEMINI_API_KEY` en overige runtime-secrets veilig instellen op doelproject.
5. `off-market-enrich-signaal` in isolatie testen met een gecontroleerd testsignaal.
6. Verifiëren dat AI-output, cache, auditlog en BAG-cascade correct werken.
7. Vercel Preview pas daarna naar doelproject laten wijzen.
8. Productie pas omschakelen na integrale acceptatie.

## 5. Harde veiligheidsgrenzen

- Geen deployment vanuit deze branch.
- Geen databasewijzigingen.
- Geen secrets schrijven of kopiëren naar GitHub.
- Geen automatische Kadasterbestellingen.
- Geen Lovable-gatewayfallback: ontbreken van `GEMINI_API_KEY` moet fail-closed zijn.
- Historische AI-runs blijven behouden; model/providerwissel mag bestaande resultaten niet herschrijven.

## Acceptatie voor deze codewijziging

- bron bevat geen `LOVABLE_API_KEY`;
- bron bevat geen `ai.gateway.lovable.dev`;
- directe Gemini-provider is expliciet getest als source contract;
- typecheck, volledige testsuite en production build groen;
- geen Supabase/Vercel/deploymentwijziging uitgevoerd.
