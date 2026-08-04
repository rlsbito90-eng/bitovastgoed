# Object-ID bronadapter schema-preflight

Deze BUILD valideert uitsluitend het verwachte databasecontract van de vijf read-only bronadapters.

## Controles

- de brontabel bestaat;
- de stabiele primaire sleutel `id` bestaat;
- er is minimaal één onafhankelijke identiteitsroute:
  - BAG-verblijfsobject-ID of BAG-pand-ID; of
  - volledig adres met adres, postcode en plaats;
- ontbrekende tabellen of identiteitspaden blokkeren de inventarisatie fail-closed.

## Veiligheidsgrens

- uitsluitend schema-/kolommetadata als invoer;
- geen productiequery in deze BUILD;
- geen databasewrite, migratie of backfill;
- geen automatische samenvoeging;
- geen Kadastercall;
- `readOnly = true` en `writes = 0` zijn onderdeel van het uitvoercontract.

Een echte broninventarisatie mag pas volgen nadat deze preflight tegen de doelomgeving `preflight_ready` oplevert en de gevonden veldnamen inhoudelijk zijn beoordeeld.
