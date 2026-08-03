# BAG BUILD 2A.13 — private Pandenverkennerintegratie

## Uitkomst

BUILD 2A.13 vervangt PR #76 niet één-op-één. Die PR verruimde de oude,
browsergestuurde PDOK-route en zou naast de inmiddels gebouwde private BAG-route
een tweede gegevenspad introduceren.

De veilige opvolger verrijkt daarom `bag_service.zoek_panden(...)` binnen de
database. De functie volgt voor uitsluitend de begrensde keysetpagina de
officiële relaties van Pand naar Verblijfsobject, hoofdadres,
Nummeraanduiding, OpenbareRuimte en Woonplaats. De service retourneert daarmee
een deterministisch hoofdadres, gezamenlijke gebruiksdoelen, totale
VBO-oppervlakte en het aantal verblijfsobjecten.

## Veiligheidsgrens

- de bestaande limiet van maximaal 250 panden blijft gelden;
- de browser gebruikt uitsluitend de geauthenticeerde Edge Function;
- `anon`, `authenticated` en `service_role` krijgen geen BAG-rechten;
- selectie blijft lokaal tot een afzonderlijke preflight en bevestiging;
- bij ingeschakelde private service wordt de oude PDOK-browserroute verborgen;
- productieactivatie, Kadasteronderzoek en automatische acquisitie blijven
  buiten scope.

## Shadowverificatie

De migratie is uitsluitend toegepast op shadowproject
`xfygspvpeugxowxbcvnm`. Op de eerste begrensde pagina van 100 Assense panden
leverden 95 panden een relationeel afgeleid adres, één of meer gebruiksdoelen,
VBO-aantal en totale oppervlakte. Panden zonder gekoppeld VBO/adres blijven
traceerbaar maar kunnen niet door de bestaande selectiepreflight.

De privilegecontrole bevestigde:

- `bag_reader`: wel `EXECUTE` op de zoekfunctie;
- `authenticated`: geen `EXECUTE`;
- `service_role`: geen `EXECUTE`;
- Supabase security advisor: nul bevindingen.
