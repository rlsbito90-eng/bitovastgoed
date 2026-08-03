# BAG BUILD 2A.8 — centrale preflight

## Uitkomst

BUILD 2A.8 combineert de afzonderlijke technische en beveiligingscontroles uit
BUILD 2A.3B tot en met 2A.7 in één read-only, fail-closed vrijgavebesluit.
De runner kan uitsluitend aan een vooraf bevestigde Supabase-shadow worden
gekoppeld. De bekende productieref `ljudxyrqoifhfikueric` staat hard op de
denylijst.

## Twee expliciete verwachtingen

- `clean-shadow`: vereist nul BAG-rijen en nul actieve datasets. Dit is de gate
  voor een schone, geïsoleerde testomgeving.
- `active-dataset`: vereist exact één actieve dataset voor de opgegeven scope,
  minimaal objecten en voorkomens en volledige staging/published-pariteit. Dit is
  de gate vlak vóór ontsluiting van een geladen versie.

Een actieve gate zonder geldige `BAG_PREFLIGHT_SCOPE_CODE` wordt vóór de
databaseverbinding geweigerd.

## Centrale controles

De preflight bewijst in één read-only transactie:

- exact vier private BAG-schema's en tien tabellen;
- geforceerde RLS op alle tabellen en het volledige policycontract;
- drie veilige `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`-rollen;
- de minimale `bag_gateway`-login, zonder credential op clean shadow en alleen
  met geconfigureerd credential voor een actieve release;
- PostGIS in `extensions` en alleen de benodigde BAG-roltoegang;
- aanwezigheid en geldigheid van de ruimtelijke, object- en versie-indexen;
- aanwezigheid van versiebeheer- en queryfuncties, met vaste owner en
  `search_path` voor de invoker-versiefuncties;
- vaste owner, `SECURITY DEFINER`, `STABLE`, `search_path` en `jit=off` voor de
  private queryfuncties;
- nul schema-, tabel- of functierechten voor `anon`, `authenticated` en
  `service_role`;
- alleen de bedoelde functiegrants voor publisher en reader;
- exact de drie oorspronkelijke `supabase_admin`-memberships plus één
  `SET`-only readerlidmaatschap voor `bag_gateway`;
- consistente datasetstatus en maximaal één actieve versie per scope;
- de gekozen clean-shadow- of active-dataset-gate.

## Uitvoering

Voor een schone shadow:

```bash
BAG_SHADOW_PROJECT_REF='<shadow-ref>' \
BAG_EXPECTED_SHADOW_PROJECT_REF='<shadow-ref>' \
BAG_SHADOW_ENVIRONMENT='shadow' \
BAG_SHADOW_DATABASE_URL='<sslmode=require-url>' \
BAG_PREFLIGHT_EXPECTATION='clean-shadow' \
bash scripts/bag/run-2a8-central-preflight.sh
```

Voor een geladen scope wordt `BAG_PREFLIGHT_EXPECTATION='active-dataset'` plus
`BAG_PREFLIGHT_SCOPE_CODE='<scope>'` gebruikt.

De runner schrijft `2a8-checks.tsv` en `2a8-report.json`. Het rapport bevat geen
database-URL, host, gebruiker of wachtwoord. Iedere ontbrekende of rode controle
maakt de exitcode ongelijk aan nul.

## Vrijgavegrens

Een groen 2A.8-rapport bewijst de database- en servicevoorwaarden, maar geeft
geen toestemming om productie te wijzigen. Productiekoppeling blijft een aparte,
expliciete handeling. Na een groene shadowcontrole kan de Pandenverkenner opnieuw
worden beoordeeld tegen deze private servicegrens.

## Live shadowbewijs

Op 3 augustus 2026 is de volledige `clean-shadow`-variant read-only uitgevoerd op
Lovable-shadow `6a89a812-bc24-4545-8da4-dcf44e209fcf`. Na BUILD 2A.9 zijn alle
zestien controles
waren groen. De database bevatte nul BAG-rijen en nul actieve datasets; productie
is niet benaderd of gewijzigd. Dezelfde lege shadow wordt in
`active-dataset`-modus bewust geblokkeerd op zowel de ontbrekende actieve dataset
als het nog niet geconfigureerde gatewaycredential. Een leeg of nog niet
operationeel ontsloten project kan dus niet als actieve release worden
goedgekeurd.
