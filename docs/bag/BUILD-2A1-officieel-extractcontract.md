# BUILD 2A.1 — Officieel BAG Extract-contract

## Doel

Deze stap vervangt aannames uit de BAG-achtige XML-proef door een formeel broncontract op basis van openbare Kadaster-documentatie. Alleen bevestigde eigenschappen worden als vast contract opgenomen. Details die uitsluitend uit de officiële XSD-set of proefbestanden kunnen volgen, blijven expliciet geblokkeerd.

## Bevestigd

- BAG Extract is een kopie van gegevens uit de LV-BAG van heel Nederland of per gemeente.
- De levering bestaat uit een verzameling XML-bestanden.
- Het extract bevat de gehele BAG inclusief historie.
- Het koppelvlak gebruikt IMBAG-versie `v20180601`.
- De actuele gepubliceerde koppelvlakdocumentatie is versie `1.9` van februari 2025.
- De BAG kent zeven objecttypen: nummeraanduiding, openbare ruimte, woonplaats, pand, verblijfsobject, standplaats en ligplaats.
- De Gemeente-Woonplaats-Relatietabel wordt als afzonderlijke bijlage geleverd.
- Het Kadaster levert geen standaardsoftware om BAG Extract in te lezen.
- De BAG API Individuele Bevragingen is niet bedoeld voor bulkimport; voor een eigen volledige bronlaag is BAG Extract het passende product.

## Nog niet invullen zonder primaire technische bron

De volgende punten mogen niet op basis van geheugen, bestaande proefcode of afgeleide voorbeelden worden ingevuld:

1. exacte namespace-URI’s;
2. exacte XML-element- en attribuutpaden;
3. bestandsnamen en ZIP-nesting;
4. objectverdeling over bestanden;
5. GML-varianten en CRS-afhandeling;
6. historie-/voorkomenvelden en selectieregels;
7. manifest-, header- en checksumstructuur.

Deze punten vereisen de officiële BAG Extract-XSD’s en minimaal één officieel proefbestand.

## Implementatieblokkade

De code bevat een expliciete gate: een productiegeschikte adapter mag pas worden gebouwd wanneer ieder mappingpunt de status `bevestigd` heeft. Tot die tijd blijft de bestaande XML-adapter uitsluitend een deterministische proefadapter.

## Gevolg voor architectuur

De definitieve keten blijft:

```text
officiële levering
→ ZIP-/bestandsinventarisatie
→ XSD-validatie
→ streaming XML/GML-adapter
→ genormaliseerde BAG-bronrecords
→ staging
→ validatie en tellingen
→ publicatie van datasetversie
→ zoekindex en kaartlaag
```

Er wordt geen koppeling met CRM-objecten toegevoegd in BUILD 2A.1.

## Volgende stap

1. officiële XSD-set verkrijgen en versie registreren;
2. officieel gemeenteproefbestand verkrijgen;
3. bestandsmanifest automatisch inventariseren;
4. namespace- en elementmapping genereren;
5. GML-fixtures uit echte proefdata anonimiseren en vastleggen;
6. pas daarna de proefadapter vervangen door een schema-gestuurde adapter.
