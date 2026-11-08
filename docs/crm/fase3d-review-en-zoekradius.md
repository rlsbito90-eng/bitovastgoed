# CRM fase 3D/3E — websitebeoordeling, zoekradius en standaard Leadstatus

## Vervolg besluit 8 november 2026

1. **Nieuwe Relaties krijgen standaard Leadstatus Actief**: reguliere nieuwe relatie, compacte aanmaak, bulk/plakimport, acquisitie vanuit eigenaarwerkstroom en automatische website-inzendingen. Bestaande leadstatuswaarden zijn ongewijzigd. Expliciet geselecteerde afwijkende status blijft mogelijk.
2. **Website-investeringsprofielen → beoordelingsinbox**: Goedkeuren, Bewerken vóór goedkeuren, Koppelen en Afwijzen met reden. De oorspronkelijke Contact Form 7-inzending blijft onaangetast. Er is een live CRM-relatiezoeker met suggesties op naam, e-mail, bedrijf en telefoon. De oorspronkelijke brondata mag de browser niet wijzigen (DB-grants beperken UPDATE tot reviewvelden).
3. **Zoekradius**: Centrumplaats, numerieke maximale afstand of reistijd, en onderscheid `km_hemelsbreed` versus `minuten_reistijd` rechtstreeks op Relaties (formulier én inline). De volledige historische tekst blijft behouden.
4. **Matching R2**: kilometerradius wordt met Haversine gecontroleerd **alleen als** geverifieerde centrum- én objectcoördinaten beschikbaar zijn; een object krijgt dan een gecontroleerde afstand in km. Als één van deze ontbreekt blijft de route **te_verifieren**, zelfs als vastgoedtype/budget passend zijn. **Reistijd is nooit automatisch hemelsbreed** en blijft voor controle door een routeplanner; géén verzonnen ETA of valse harde mismatch.
5. De vier reeds bestaande afstands-/reistijdvoorkeuren zijn brongetrouw overgezet: centrum Amersfoort 35 km, Utrecht 25 km, Bergen op Zoom 25 km, Ede 60 minuten. De vier oorspronkelijke toelichtingen blijven intact.

## Supabase migraties toegepast

- `20261108224017_website_intakes_review_reason_fase3d.sql`: review_reason/reviewed_by.
- `20261108224727_nieuwe_relaties_standaard_leadstatus_actief.sql`: `lead_status` default Actief en wijziging server-RPC voor website-instroom.
- `20261108225057_relaties_gestructureerde_zoekradius_fase3e.sql`: radiuskolommen/geo-coördinaatkolommen en gecontroleerde backfill van vier.
- `20261108225610_website_intakes_beperk_bewerking_tot_reviewvelden.sql`: beheerder mag oorspronkelijke websiteinzending niet muteren.

## Veilige vervolgfase voor geocodering

Nog **geen** automatische live geocodering van relatiecentrum of objectadres uitgevoerd. Er staan geen geverifieerde `geo_lat`/`geo_lon` waarden op de huidige objecten, dus geconfigureerde radiusprofielen blijven voor locatie altijd ter controle tot de BAG/PDOK-verrijking voltooid is. De structuur en afstandsvergelijker zijn hiervoor voorbereid. Voor een echte afstandsindicatie is voor het object een concreet gevalideerd adres/postcode/huisnummer of geverifieerde locatie nodig; alleen provincie of een plaatsnaam is niet voldoende voor een harde match. Voor reistijd is een routingsysteem nodig.

## Vervolgdiscussie: LinkedIn-kopers

De bestaande knop **Meerdere toevoegen** (voorheen Bulk importeren) accepteert al CSV en rechtstreeks geplakte Excel-kolommen, inclusief voorbeeld/validatie. Een losse `QuickCreateRelationDialog` bestaat al in de code, maar is nog niet als knop op Relaties geïntegreerd. Advies: (1) snelle toevoeging via compact formulier met LinkedIn-link, (2) meerdere rijen plakken met deduplicatie, (3) daarna een apart kwaliteits-/verrijkingsmoment om investeringscriteria te vervolledigen. Geen ongeautoriseerde LinkedIn-scraping of automatische verzonnen contactgegevens.

## Acceptatie

- Geen automatische wijziging van bestaande investeringscriteria.
- Geen extra Zoekprofielen gemaakt.
- Nieuwe websitebeoordeling vraagt expliciet akkoord; de afwijzing heeft een reden.
- Reden/status van beoordeling blijft zichtbaar in inbox; gekoppelde relatie vanuit de inzending openen.
- Voor klanten met alleen radius blijft matching te_verifieren, niet onvoldoende.
- Productie pas na groene typecheck, regressietests, build en READY deployment.
