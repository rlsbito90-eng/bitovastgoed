# Multi-adres en onderdelen — uitvoeringsvoorwaarden

Status: op `crm-test` uitgewerkt, **niet geïmplementeerd in Supabase**.

## Wat is al werkend
- Portefeuilleonderdelen gekoppeld via bestaand `objecten.parent_object_id`.
- De Objecten-lijst kan gekoppelde kinderen gegroepeerd of los tonen.
- Adres/postcodezoekfunctie inclusief adressen in gekoppelde onderliggende dossiers.
- Bestaande interne adresgegevens worden bij nieuwe anonieme objecten voortaan bewaard.
- `adresModel.ts` kan oude enkelvoudige dossiers lezen en toekomstige meerdere adressen valideren, zonder writes.

## Nog niet werkend
- Meerdere adressen opslaan rechtstreeks binnen één object zonder losse kindrecords.
- De nieuwe tabellen `crm_object_adressen` en `crm_object_onderdelen` bestaan nog niet.
- BAG/kadaster-validatie per afzonderlijk adres en m²-/huur-verdeling per gebruiksfunctie.
- Een verkooppropositie als aparte commerciële entiteit met gecombineerde pipeline.
- Matchen op meerdere objectonderdelen, harde criteria via Relaties, en volledige portefeuille-aggregatie.

## Database-audit (14 november 2026, alleen SELECT)
- `objecten`: 55 records.
- `is_portefeuille=true`: 5 records; `parent_object_id is not null`: 3 records.
- `property_types`: 17, `property_subtypes`: 263, `deal_types`: 30.
- Een aantal oude objecten gebruikt nog alleen legacy-classificatie; bedrijfsmatig, maatschappelijk,
  transformatie en andere brede categorieën mappen niet één-op-één.
- De data is **niet** automatisch geconverteerd of geherclassificeerd.

## Veiligheids- en implementatievolgorde
1. Maak of activeer een **echte geïsoleerde** testdatabase met geanonimiseerde testdata en
   configureer aparte preview-variabelen. Huidige `crm-test` gebruikt nog de productie-Supabase.
2. Herzien van het ontwerp-SQL onder `docs/crm/sql/`, daarna pas als migratie
   genereren en uitvoeren in die geïsoleerde omgeving. RLS en grants testen met anonieme,
   interne en niet-geautoriseerde rollen.
3. Maak een transactionele server-/RPC-save: hoofdadres 0→1, adresbehoud, dubbele adressen,
   validatie van `object_id` en componenten met hetzelfde object. Test conflicts en rollback.
4. Maak een gecontroleerde, uitsluitend leesbare legacy→nieuw-preview:
   `objecten.adres` is legacy fallback; bij nieuwe adressen mag het niet dubbel tellen.
5. UI: adressen binnen één object toevoegen/bewerken, BAG-check, Google Maps per adres;
   componenten per gebruiksfunctie. Eenvoudige panden hoeven geen onderdelen te krijgen.
6. Daarna pas gedeelde vastgoedtaxonomie en geparametriseerde koopcriteria bij Relaties,
   0–100 matchscore plus onafhankelijke harde geschiktheidsvoorwaarde.
7. Laatste stap: gecontroleerde migratie bestaande dossiers (Geuzenweg, 3 Amsterdamse
   appartementen) met auditverslag en behoud van alle pipeline-/aanbiedingshistorie.

## Behoud van gegevens
- Geen automatische creatie van extra objecten of verwijdering van bestaande kindrecords.
- Geen verdeling van portefeuille-vraagprijzen over onderliggende appartementen.
- Geen optelling van GBO, VVO of BVO als zouden het dezelfde eenheid zijn.
- Geen automatische conversie van `type_vastgoed` naar een onjuiste hoofdgroep.
- Nieuwe status 'controle nodig' bij ontbrekende of strijdige broninformatie.
