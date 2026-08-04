# Object-ID backfill stop/go-poort

Deze BUILD beoordeelt uitsluitend of een bronrecord technisch in aanmerking komt voor een latere centrale Object-ID-backfill.

## Beslisvolgorde

1. bronrecord en broninventarisatie moeten volledig zijn;
2. tegenstrijdige BAG- of adresidentiteit gaat altijd naar handmatige beoordeling;
3. meerdere centrale Object-ID-kandidaten blokkeren automatische koppeling;
4. exact één eenduidige match kan als koppelvoorstel worden gerapporteerd;
5. geldige BAG-identiteit zonder bestaand object kan als nieuw-objectvoorstel worden gerapporteerd;
6. uitsluitend adres zonder BAG-onderbouwing blijft handmatige beoordeling.

## Veiligheidsgrens

- `mutationAllowed = false`;
- `writes = 0`;
- geen databasequery;
- geen backfill;
- geen automatische merge;
- geen Kadastercall;
- geen productie- of shadowwijziging.

Een positieve beslissing is uitsluitend een voorstel voor latere beoordeling en geeft geen toestemming om data te muteren.
