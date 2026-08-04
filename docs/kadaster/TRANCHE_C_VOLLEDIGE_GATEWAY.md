# Tranche C — Volledige Kadaster/BAG-gateway

## Status

Deze BUILD rondt Tranche C op code-, contract- en veiligheidsniveau af.

## Doel

Alle BAG- en Kadasterverzoeken lopen via één centrale server-side gateway. De browser mag nooit rechtstreeks een provider benaderen en ontvangt nooit een API-secret.

## Volledige keten

1. Verzoek bevat gebruiker, module, doel en centrale objectreferentie.
2. Productpolicy bepaalt gratis/betaald, PII, rol, omgeving, prijs en cacheduur.
3. Cache/deduplicatie gebruikt BAG-VBO-ID, daarna BAG-pand-ID, daarna CRM Object-ID en pas daarna adres.
4. Productie is in Tranche C volledig geblokkeerd.
5. Geldige cache wordt zonder providercall hergebruikt.
6. Gratis producten volgen de free-first route.
7. Betaalde producten zijn opgenomen in de catalogus en kostenraming, maar blijven technisch uitgeschakeld tot Tranche D.
8. Iedere beslissing en ieder resultaat vereist een append-only auditregel.
9. Alleen resultaten met werkelijke kosten van exact nul euro worden door de Tranche C-uitvoerder geaccepteerd.
10. Providerresultaten worden centraal gecachet en herbruikbaar gemaakt voor alle CRM-modules.

## Producten in Tranche C

### Ingeschakeld voor Preview/Shadow

- BAG Individuele Bevraging — gratis
- Objectinformatie Algemeen — gratis
- Gemeentelijke lasten — gratis
- Buurtstatistieken — gratis

### Geregistreerd maar geblokkeerd tot Tranche D

- Rechten — eigenaar/PII en betaald
- Koopsom — betaald
- WOZ — betaald
- Omgeving — betaald

De geregistreerde prijzen zijn uitsluitend beleidsmetadata voor kostenpreview en budgettering. Deze BUILD doet geen aankoop en activeert geen betaald product.

## Rechten en privacy

- eigenaarinformatie is admin-only;
- PII wordt nooit als cachekey gebruikt;
- objectreferenties worden in auditregels uitsluitend als hash opgeslagen;
- providercredentials blijven server-side;
- productie staat uit;
- betaalde producten staan uit;
- Auth blijft verplicht.

## Budget en kosten

De gateway ondersteunt:

- bedrijfsbudget per maand;
- gebruikersbudget per dag;
- gebruikersbudget per maand;
- waarschuwingdrempel;
- harde blokkade;
- kostenschatting vooraf;
- werkelijke kosten achteraf;
- cachehergebruik zonder nieuwe kosten.

In Tranche C mogen werkelijke kosten uitsluitend `0` zijn.

## Audit

Iedere aanvraag registreert minimaal:

- request-ID;
- actor-ID;
- module en doel;
- product;
- omgeving;
- besluit;
- geschatte en werkelijke kosten;
- cachehit;
- externe providercall;
- hash van objectreferentie;
- approval-ID indien aanwezig;
- eindstatus.

## Harde veiligheidsgrenzen

```text
browserMayCallProviderDirectly = false
productionAllowed = false
paidProductsEnabled = false
ownerPiiViaBrowser = false
actualCostCents = 0
```

## Niet uitgevoerd

- geen providersecret toegevoegd;
- geen externe BAG- of Kadastercall uitgevoerd;
- geen productieconfiguratie gewijzigd;
- geen betaald product geactiveerd;
- geen aankoop gedaan;
- geen database-migratie toegepast;
- geen productie-CRM-data gewijzigd.

## Afsluitcriterium

Na groene checks is Tranche C compleet op code- en contractniveau. Operationele aansluiting van een echte providerclient en secrets mag uitsluitend in Preview/Shadow plaatsvinden en vereist een afzonderlijke deployment-/configuratiestap. Betaalde producten en eigenaarinformatie behoren tot Tranche D.
