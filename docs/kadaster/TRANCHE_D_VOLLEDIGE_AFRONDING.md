# Tranche D — betaalde Kadasterproducten en kostenbeheer

## Status

Tranche D is op code-, contract- en veiligheidsniveau compleet zodra de bijbehorende checks groen zijn.

## Scope

- betaalde producten: Rechten, Koopsom, WOZ en Omgeving;
- uitsluitend shadowomgeving;
- admin-only aankopen;
- expliciete, beperkte en vervallende aankoopgoedkeuring;
- prijsmaximum en maximumaantal gebruiken per goedkeuring;
- bedrijfsbudget per maand;
- gebruikersbudget per dag en maand;
- reservering vóór providercall;
- definitieve charge op basis van werkelijke kosten;
- release bij lagere kosten of mislukte call;
- afzonderlijke correctie bij hogere kosten;
- afzonderlijke refund zonder historische events te wijzigen;
- idempotency tegen dubbele aankopen;
- append-only kostenledger;
- PII-classificatie en PII-vault-eis voor Rechten;
- server-side secret en providerclient;
- harde productie- en browserblokkade.

## Veilige aankoopketen

1. De gebruiker vraagt een betaald product aan.
2. De gateway controleert rol, omgeving, objectidentiteit en product.
3. Een expliciete goedkeuring moet exact overeenkomen met product, doel, prijsmaximum en scope.
4. De budgetten worden inclusief bestaande reserveringen gecontroleerd.
5. Een immutable reservation-event wordt aangemaakt.
6. Alleen de server-side providerclient mag de providercall uitvoeren.
7. Het resultaat wordt op kosten en PII-classificatie gecontroleerd.
8. De werkelijke charge wordt append-only geboekt.
9. Niet-gebruikte reservering wordt vrijgegeven; afwijkingen worden als afzonderlijke correctie geboekt.
10. Iedere refund is een nieuw event dat naar de oorspronkelijke charge verwijst.

## Productiegrens

Tranche D activeert niets in productie. `productionAllowed` blijft altijd `false`.

## Operationele activatie

Een echte shadowaankoop blijft geblokkeerd totdat aantoonbaar aanwezig zijn:

- providerclient;
- server-side secret;
- budgetopslag;
- goedkeuringsopslag;
- append-only kostenledger;
- retentiebeleid;
- PII-vault voor eigenaarinformatie;
- aparte expliciete operationele autorisatie.

De aanwezigheid van deze code is geen aankoopopdracht en geen toestemming om credentials toe te voegen of een Kadasterproduct af te nemen.

## Niet uitgevoerd in deze BUILD

- geen providersecret toegevoegd;
- geen externe Kadastercall;
- geen aankoop;
- geen kosten geboekt;
- geen productieconfiguratie gewijzigd;
- geen CRM-data gewijzigd;
- geen migratie toegepast.
