# BUILD 2A.1 — Parser- en import-runcontract

## Status

Ontwerp- en testcontract. Nog geen echte BAG-download, parser, database-import of productiemigratie.

## Doel

De eerste volledige gemeenteproef moet aantoonbaar:

- hervatbaar zijn na een fout of onderbreking;
- iedere verwerkingsfase expliciet administreren;
- alle geweigerde bronregels verklaren;
- bronchecksum en gemeentelijke scope controleren;
- objecttellingen, relaties en geometrieën valideren;
- idempotent opnieuw uitgevoerd kunnen worden;
- pas na volledige validatie publiceerbaar zijn;
- de vorige datasetversie behouden voor rollback;
- geen CRM-schrijfacties uitvoeren.

## Importfasen

1. `bron_verificatie`
2. `uitpakken`
3. `parsen`
4. `staging_load`
5. `validatie`
6. `publicatie`
7. `zoekindex`
8. `ruimtelijke_koppeling`

Iedere fase krijgt een checkpoint met:

- fase;
- hervatcursor;
- aantal verwerkte records;
- aantal geweigerde records;
- voltooiingsstatus;
- laatste wijzigingsmoment.

## Statusmodel

De import-run gebruikt expliciete statusovergangen. Rechtstreeks springen van `aangemaakt` naar `gepubliceerd` is verboden. Een mislukte run mag alleen hervatten in een verwerkingsfase; een gepubliceerde run kan uitsluitend naar `teruggedraaid`.

## Staging en publicatie

De proef publiceert nooit rechtstreeks tijdens het parsen. De volgorde is:

```text
bronbestand
→ checksum en scope controleren
→ streamend parsen
→ staging vullen
→ tellingen, relaties en geometrieën valideren
→ publicatiebesluit
→ actieve datasetversie atomair wisselen
→ zoekindex opbouwen
→ wijk- en buurtkoppeling opbouwen
```

De precieze database-implementatie wordt pas gekozen na de volumeproef. Het contract veronderstelt wel dat staging en de actieve bronversie logisch gescheiden zijn.

## Afwijzingen

Iedere afgewezen bronregel krijgt minimaal:

- objecttype;
- bronidentificatie indien beschikbaar;
- vaste reden-code;
- menselijke toelichting.

`stilleUitval` moet altijd nul zijn. Records mogen niet verdwijnen zonder telling en reden.

## Publicatievoorwaarden

Publicatie is alleen toegestaan wanneer:

- de run `klaar_voor_publicatie` is;
- checksum en bronscope zijn geverifieerd;
- objecttellingen sluiten;
- relaties sluiten;
- geometrieën geldig zijn;
- idempotentie is aangetoond;
- stille uitval nul is;
- iedere afwijzing is verklaard;
- vorige datasetversie bewaard blijft;
- zoekindex en ruimtelijke koppeling opnieuw worden opgebouwd;
- CRM-schrijfacties uitgeschakeld blijven.

## Rollback

Rollback is alleen toegestaan wanneer:

- de nieuwe dataset reeds is gepubliceerd;
- een vorige actieve datasetversie bekend is;
- deze vorige versie daadwerkelijk is bewaard.

Rollback verandert alleen welke BAG-dataset actief is. Geselecteerde Vastgoedkansen, Objecten en Deals worden niet automatisch gewijzigd of verwijderd.

## Eerstvolgende uitvoerbare stap

Na acceptatie van dit contract volgt een lokale parserproef met een kleine, vaste fixture. Die proef moet:

- zonder netwerk en zonder Supabase kunnen draaien;
- records streamend verwerken;
- checkpoints produceren;
- afwijzingen registreren;
- deterministische tellingen opleveren;
- bij een tweede run exact hetzelfde resultaat geven.

Pas daarna wordt een geïsoleerde proefdatabase of tijdelijk schema aangesloten.
