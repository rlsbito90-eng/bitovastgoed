# BAG BUILD 2A.15 — cross-project shadowtransport

## Aanleiding

De bestaande Supabase-client is gekoppeld aan CRM-productieproject
`ljudxyrqoifhfikueric`. Een aanroep via `supabase.functions.invoke()` zou de
BAG-functie daarom op productie zoeken, terwijl functie en data uitsluitend op
shadowproject `xfygspvpeugxowxbcvnm` mogen draaien.

## Oplossing

De browsertransportlaag gebruikt een expliciete HTTPS-aanroep. De ingestelde
`VITE_BAG_QUERY_FUNCTION_URL` moet bytegelijk zijn aan:

`https://xfygspvpeugxowxbcvnm.supabase.co/functions/v1/bag-query-service`

De huidige CRM-access-token wordt uitsluitend als bearer-token meegestuurd. De
shadowfunctie valideert deze token daarna zelf bij de productie-authautoriteit
en controleert de interne rol. Er wordt geen shadow-API-key, databasecredential
of service-role-key aan de browser toegevoegd.

## Fail-closed grenzen

- ontbrekende, afwijkende of naar productie wijzende functie-URL blokkeert vóór
  enig netwerkverzoek;
- ontbrekende CRM-sessie blokkeert vóór enig netwerkverzoek;
- transport- en HTTP-fouten worden gemaskeerd;
- het shadowplatform draait de functie met `verify_jwt=false`, omdat zijn eigen
  gateway de productietoken niet kan verifiëren; de functie zelf blijft JWT plus
  `admin`/`medewerker` afdwingen;
- de frontendfeatureflag blijft uit tot de serversecrets en interne sessieproef
  groen zijn.

## Previewvariabelen

Pas na een groene gatewayproef:

- `VITE_BAG_QUERY_SERVICE_ENABLED=true`;
- `VITE_BAG_QUERY_SCOPE_CODE=0106`;
- `VITE_BAG_QUERY_FUNCTION_URL=https://xfygspvpeugxowxbcvnm.supabase.co/functions/v1/bag-query-service`.
