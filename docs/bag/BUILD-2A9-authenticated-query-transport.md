# BAG BUILD 2A.9 — geauthenticeerd querytransport

## Uitkomst

BUILD 2A.9 legt de ontbrekende servergrens tussen de browser en de private
`bag_service`-functies vast. De frontend krijgt geen database-URL, readerrol of
service-role-key. Alle databasequery's lopen via de geauthenticeerde Edge Function
`bag-query-service`.

## Transportidentiteit

De migratie maakt `bag_gateway` met:

- `LOGIN`, maar zonder wachtwoord in migratiecode;
- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`,
  `NOREPLICATION`, `NOBYPASSRLS`;
- maximaal acht databaseverbindingen;
- nul directe schema-, tabel-, sequence- of functierechten;
- uitsluitend toestemming om per transactie `SET LOCAL ROLE bag_reader` te doen.

Een verse schema-uitvoering levert daarom nog geen bruikbaar credential op.
Wachtwoordgeneratie en het plaatsen van `BAG_READER_DATABASE_URL` als Edge-secret
zijn een afzonderlijke handmatige operatie buiten Git en buiten deze build.

## Edge-grens

De functie:

- accepteert alleen `POST` en maximaal 16 KiB requestbody;
- valideert de bestaande Supabase-JWT;
- staat alleen CRM-rollen `admin` en `medewerker` toe;
- gebruikt geen `SUPABASE_SERVICE_ROLE_KEY`;
- weigert iedere omgeving behalve een exact bevestigde shadow;
- blokkeert productieref `ljudxyrqoifhfikueric`;
- accepteert alleen vaste acties `viewport` en `search`;
- herhaalt alle scope-, limiet-, cursor- en RD New-validatie server-side;
- gebruikt maximaal twee databaseverbindingen;
- voert binnen een transactie eerst `SET LOCAL ROLE bag_reader` uit;
- retourneert geen database- of configuratiedetails bij fouten.

## Frontendadapter

`queryTransport.ts` is de enige browseradapter. Hij valideert aanvragen vóór het
netwerkverzoek en roept uitsluitend de Edge Function aan via de bestaande
gebruikerssessie. De adapter kan geen directe Postgres- of Supabase-BAG-query doen.

## Niet geactiveerd

Deze build implementeert en verifieert code en het shadow-rolcontract. De Edge
Function wordt niet naar productie gedeployed en er wordt geen gatewaywachtwoord
of secret aangemaakt. Activering vereist later afzonderlijk:

1. een groen 2A.8 `active-dataset`-rapport;
2. handmatige credentialprovisioning en secretplaatsing;
3. een shadow-deploymenttest met een geldige interne JWT;
4. een afzonderlijke productiegoedkeuring.

BUILD 2A.10 kan nu de lijst-/filterinterface op deze adapter bouwen zonder kaart en
zonder de private databasegrens te doorbreken.

## Live shadowbewijs

Het rolcontract is op 3 augustus 2026 toegepast op Lovable-shadow
`6a89a812-bc24-4545-8da4-dcf44e209fcf`. De uitgebreide 2A.8-preflight was daarna
16/16 groen. Aanvullend is rechtstreeks uit de catalogus bewezen:

- geen schema-USAGE voor `bag_gateway`;
- geen functie-EXECUTE voor `bag_gateway` zonder rolwissel;
- geen geërfde `bag_reader`-rechten;
- wel uitsluitend `SET`-toestemming naar `bag_reader`;
- geen gatewaycredential aanwezig.

Productie is niet benaderd of gewijzigd.
