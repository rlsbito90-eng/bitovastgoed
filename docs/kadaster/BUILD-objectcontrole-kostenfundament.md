# BUILD — CRM-brede objectcontrole en Kadaster-kostenfundament

## Doel

Leg de veilige basis vast voor:

1. onderweg een adres, BAG-pand of verblijfsobject controleren;
2. herkennen of hetzelfde vastgoed al voorkomt in Vastgoedkansen, Objecten of Off-Market Radar;
3. een bestaand dossier openen in plaats van dupliceren;
4. Kadasterproducten per object gecontroleerd aanvragen;
5. kosten per aanvraag, gebruiker, object, campagne, week en maand rapporteren;
6. beheerbare waarschuwingen, bevestigingsgrenzen en budgetlimieten toepassen.

## In deze BUILD

### CRM-brede objectcontrole

De objectcontrole gebruikt de volgende matchvolgorde:

1. BAG-verblijfsobject-ID;
2. BAG-pand-ID;
3. genormaliseerd adres, postcode en plaats.

Bij meerdere matches heeft een Vastgoedkans functioneel voorrang, daarna een Object en daarna een Off-Market-signaal. Alle matches blijven in het resultaat behouden. De aanbevolen actie is daardoor één van:

- bestaande Vastgoedkans openen;
- bestaand Object openen;
- gekoppelde Off-Market-signalen bekijken;
- nieuwe Vastgoedkans starten.

Dit is nog geen definitieve centrale CRM-object-ID of databasekoppeling. Het is het domeincontract waarop de Snelle pandcheck en latere objectregistratie veilig kunnen worden gebouwd.

### Kadasterproductcatalogus

Het model kent productcodes voor algemene objectinformatie, Contractloos, rechten, koopsom, omgeving en WOZ. Betaalde producten staan standaard inactief en hun tarief staat standaard op nul.

Actuele tarieven worden bewust niet in broncode als blijvende waarheid vastgelegd. Vóór activering moeten product, tariefeenheid, btw-behandeling en contractvoorwaarden vanuit het zakelijke Kadasteraccount worden bevestigd en beheerd als versieerbare configuratie.

### Kostenregister

Elk toekomstig Kadasterverzoek krijgt een kosten-event met onder meer:

- product en aantal eenheden;
- geraamde en werkelijke kosten;
- status van raming tot levering of mislukking;
- gebruiker;
- CRM-object, Vastgoedkans of campagne;
- adres, BAG-ID en kadastrale aanduiding;
- request-ID en aanvraag-/levermoment;
- indicatie dat bestaande data is hergebruikt.

Niet-geleverde, mislukte en hergebruikte resultaten tellen niet mee als besteed budget.

### Budgetbeleid

Het beleid ondersteunt:

- daglimiet per gebruiker;
- maandlimiet per gebruiker;
- maandbudget voor het bedrijf;
- extra bevestiging vanaf een instelbaar bedrag;
- waarschuwingen bij instelbare percentages;
- harde blokkade aan of uit;
- beheerder die een blokkade mag overschrijven.

De standaardwaarden zijn startconfiguratie en moeten later via beheerinstellingen worden opgeslagen. Een beheerder blijft in staat het beleid te verhogen, te verlagen of uit te schakelen.

### Week- en maandrapportage

De rapportagefunctie aggregeert voor een willekeurige periode:

- aantal aanvragen;
- aantal gefactureerde eenheden;
- geraamde kosten;
- werkelijke kosten;
- uitsplitsing per Kadasterproduct.

Hiermee kan later bijvoorbeeld worden getoond: `12 rechteninformatie-aanvragen, 12 eenheden, € X werkelijke kosten deze week`.

## Veiligheidsgrens

Deze BUILD:

- voert geen Kadaster-API-call uit;
- bevat geen API-key, secret of accountgegeven;
- maakt geen betaalde bestelling;
- wijzigt geen productie- of shadowdatabase;
- activeert geen product of tarief;
- verwerkt nog geen persoonsgegevens van rechthebbenden;
- voegt nog geen automatische aanvraag toe bij openen, zoeken of importeren.

## Vervolgtranches

1. centrale object-ID en persistente koppeltabellen;
2. mobiele Snelle pandcheck met BAG-zoekresultaat en CRM-brede matches;
3. beheerpagina voor productcatalogus, tarieven en budgetbeleid;
4. persistent kostenregister en week-/maanddashboard;
5. server-side Kadastergateway met rollen, secrets en audittrail;
6. gratis productproef;
7. afzonderlijke betaalde productproef met expliciete prijsbevestiging;
8. appartementsrecht-, perceel- en rechthebbendenweergave met privacygrenzen.
