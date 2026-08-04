# Amsterdam BAG-bronpakket — acceptatiecontract

## Doel

Dit contract voorkomt dat een Amsterdam-import start op basis van een onvolledig, verkeerd of niet-herleidbaar bronpakket.

De import blijft geblokkeerd totdat één manifest alle onderstaande gegevens bevat en de automatische validatie slaagt.

## Verplichte identiteit

- gemeentecode `0363`;
- gemeentenaam Amsterdam;
- leverancier Kadaster;
- product BAG Extract;
- leverdatum en ontvangstdatum in `YYYY-MM-DD`;
- registratie van de gebruikte officiële bron-URL;
- manifestversie `1`.

## Verplichte bestanden

Het manifest registreert minimaal bestanden voor:

1. objecten;
2. voorkomens;
3. relaties;
4. geometrieën.

Per bestand zijn verplicht:

- relatief bestandspad;
- SHA-256-checksum;
- bestandsgrootte in bytes;
- inhoudstype.

Dubbele paden zijn niet toegestaan. Een herhaalde checksum geeft minimaal een waarschuwing en moet vóór import worden verklaard.

## Verplichte tellingen

Voor objecten, voorkomens, relaties en geometrieën wordt vóór import een positieve verwachte telling vastgelegd. Deze tellingen zijn de referentie voor:

- capaciteitsraming;
- tranchebesluit;
- volledigheidscontrole na staging;
- afwijkingsrapportage;
- rollbackbesluit.

## Datasetversie-identiteit

De datasetversie wordt deterministisch opgebouwd uit:

`scopeCode + leverdatum + gesorteerde bestandschecksums`

Daardoor krijgt hetzelfde bronpakket altijd dezelfde identiteit, onafhankelijk van de volgorde waarin bestanden in het manifest staan.

## Harde blokkades

De Amsterdam-import mag niet starten bij:

- een andere gemeentecode dan `0363`;
- ontbrekende of ongeldige checksums;
- ontbrekende kerntypen;
- lege of niet-positieve tellingen;
- ontbrekende bronregistratie;
- onbekende manifestversie;
- onvoldoende vrije shadowcapaciteit;
- niet-geteste rollback/herstart;
- reeds geactiveerde client- of serverallowlist voor Amsterdam.

## Buiten scope

Dit contract:

- downloadt geen BAG-data;
- wijzigt geen Supabase-schema;
- importeert geen rijen;
- activeert Amsterdam niet;
- wijzigt de productie-CRM niet;
- automatiseert geen Kadaster- of eigenaaronderzoek.
