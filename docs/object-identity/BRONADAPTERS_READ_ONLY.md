# Object-ID bronadapters — read-only contract

## Doel

Deze BUILD vertaalt vijf bestaande CRM-bronnen naar één uniform Object-ID-inventarisatiecontract:

- Vastgoedkansen;
- Objecten/Aanbod;
- Off-Market-signalen;
- Deals;
- acquisitietargets.

De adapters voeren zelf geen databasequery uit. Zij beschrijven uitsluitend welke tabel en kolommen read-only moeten worden gelezen en hoe een ontvangen rij zonder aannames naar het centrale inventarisatiecontract wordt vertaald.

## Identiteitsvolgorde

1. BAG-verblijfsobject-ID;
2. BAG-pand-ID;
3. volledig adres: adres, postcode en plaats;
4. handmatige beoordeling.

Een bestaand intern `object_id` of `crm_objectregistratie_id` is context, maar nooit zelfstandig bewijs dat twee bronrecords hetzelfde fysieke vastgoedobject vertegenwoordigen.

## Objecten/Aanbod

Objecten/Aanbod moet structureel worden verrijkt met:

- `bag_verblijfsobject_id` wanneer het dossier één specifiek verblijfsobject betreft;
- `bag_pand_id` wanneer het dossier een volledig gebouw betreft;
- beide identifiers wanneer die relatie ondubbelzinnig is.

Ontbrekende BAG-identificaties worden niet afgeleid uit vrije tekst. Het adres blijft alleen een gecontroleerde fallback voor de latere BAG-verrijkingsstap.

## Veiligheidsgrenzen

- uitsluitend SELECT-contracten;
- `writes = 0`;
- geen productiequery in deze BUILD;
- geen schemawijziging;
- geen automatische dossiermerge;
- geen Kadastercall;
- onbekende of ontbrekende velden blijven `null`;
- alleen expliciet bekende veldnamen worden ondersteund.

## Stop/go-poort

Een werkelijke broninventarisatie mag pas worden uitgevoerd nadat per adapter is bevestigd dat de tabelnaam en geselecteerde kolommen in de doelomgeving bestaan. Schema-afwijkingen leiden tot een geblokkeerd rapport, niet tot fallback op brede `select *`-queries.
