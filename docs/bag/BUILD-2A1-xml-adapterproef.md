# BUILD 2A.1 — XML-adapterproef

## Doel

Een geïsoleerde adapter bewijst dat BAG-achtige XML-records deterministisch kunnen worden vertaald naar de reeds vastgelegde parsercontracten, zonder netwerk, database of productiegegevens.

## Scope

De proef ondersteunt uitsluitend:

- `Pand`;
- `Verblijfsobject`;
- `Nummeraanduiding`;
- XML-namespaces;
- records die over meerdere tekstchunks zijn verdeeld;
- expliciete melding wanneer de invoer midden in een BAG-record eindigt.

## Buiten scope

- geen claim van volledige compatibiliteit met het officiële BAG Extract-koppelvlak;
- geen ZIP- of GML-bestandsverwerking;
- geen SAX-library;
- geen geometrieconversie;
- geen Supabase- of PostGIS-schrijfacties;
- geen landelijke of gemeentelijke import.

## Architectuur

```text
XML chunks
  → complete BAG-recordgrenzen herkennen
  → lokale tags namespace-onafhankelijk uitlezen
  → BagBronRecord
  → bestaande parseBagFixture-kern
  → genormaliseerde objecten, relaties en afwijzingen
```

De adapter kent geen commerciële CRM-concepten. Promotie naar Vastgoedkans, Object of Deal blijft onmogelijk.

## Veiligheids- en kwaliteitsregels

1. Een record wordt pas uitgegeven nadat de afsluitende XML-tag is ontvangen.
2. Chunkgrenzen mogen de functionele uitkomst niet beïnvloeden.
3. Namespaces mogen de lokale BAG-tagnaam niet wijzigen.
4. Onvolledige eindrecords worden expliciet gemeld.
5. De bestaande parser blijft verantwoordelijk voor domeinvalidatie, deduplicatie en relatiecontrole.
6. De proefadapter is geen productie-XML-parser en mag niet voor echte BAG-leveringen worden gebruikt voordat het officiële koppelvlak met representatieve fixtures is gevalideerd.

## Vervolg

De volgende stap is een officiële-schema-adapterdiagnose:

- concrete bestands- en namespace-indeling van een echte BAG Extract-levering vaststellen;
- vaststellen welke XML/GML-parser en ZIP-streamingstrategie nodig is;
- officiële identificatie- en relatiepaden mappen;
- geometrie apart behandelen;
- daarna één klein, legaal verkregen BAG-fragment als integratiefixture verwerken.
