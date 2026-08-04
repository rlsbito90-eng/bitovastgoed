# Centrale Object-ID — broninventarisatie dry-run

## Doel

Breng vóór iedere backfill per CRM-bron vast welke records veilig koppelbaar zijn via:

1. BAG-verblijfsobject-ID;
2. BAG-pand-ID;
3. volledig genormaliseerd adres.

De inventarisatie schrijft niets en maakt geen objectregistraties of bronkoppelingen aan.

## Bronnen

- Vastgoedkansen;
- Objecten/Aanbod;
- Off-Market-signalen;
- Deals;
- acquisitietargets.

Iedere bron wordt via een expliciete adapter naar hetzelfde read-only contract gebracht. De repositorytypen bevestigen voor `acquisitie_targets` de velden `id`, `adres`, `postcode`, `plaats` en een bestaand `object_id`. Voor iedere andere bron moet de adapter uitsluitend werkelijk aanwezige velden mappen; ontbrekende BAG-identificaties mogen niet worden afgeleid of verzonnen.

## Rapportage

Per bron:

- totaal aantal records;
- aantal met geldige BAG-verblijfsobject-ID;
- aantal met geldige BAG-pand-ID;
- aantal met volledig adres;
- aantal met bestaand object-ID;
- veilig koppelbaar;
- handmatig te beoordelen.

Datakwaliteitsproblemen worden afzonderlijk geregistreerd, waaronder:

- ontbrekende bron-ID;
- ongeldige BAG-ID;
- gedeeltelijk adres;
- ontbrekende onafhankelijke identiteit;
- bestaand object-ID zonder BAG-ID of volledig adres.

## Stop/go-poort

Een uitvoerbare backfill blijft geblokkeerd zolang:

- bronadapters niet expliciet zijn gevalideerd;
- de werkelijke productiebroninventarisatie niet read-only is uitgevoerd;
- ambigue en onvolledige records niet afzonderlijk zijn beoordeeld;
- geen herstel- en rollbackrapport beschikbaar is;
- geen expliciete goedkeuring voor de muterende backfill is gegeven.

## Veiligheidsgrens

- geen productie-write;
- geen shadow-backfill;
- geen automatische dossiermerge;
- geen Kadaster- of eigenaaractie;
- `automaticWrites` blijft hard `0`;
- een bestaand `object_id` is geen zelfstandig bewijs van dezelfde fysieke zaak.
