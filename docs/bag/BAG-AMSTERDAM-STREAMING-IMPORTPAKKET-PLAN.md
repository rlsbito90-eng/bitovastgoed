# BAG Amsterdam — streaming importpakketplan

## Aanleiding

De gevalideerde Amsterdam full-subset bevat 3.037.017 NDJSON-records. De bestaande importpakketvoorbereiding is functioneel bewezen op kleinere datasets, maar houdt bij Amsterdam meerdere volledige representaties tegelijk in het Node.js-geheugen.

Run `31102352499` bevestigt de structurele grens:

- 15 GiB RAM beschikbaar;
- 10 GiB swap beschikbaar;
- Node.js-heap ingesteld op 10 GiB;
- bronartifact, checksum en 3.037.017 regels succesvol gevalideerd;
- proces faalt tijdens de omzetting met `JavaScript heap out of memory` rond 10.036 MiB heapgebruik;
- geen databasewrite en geen Supabase-benadering.

Meer geheugen toevoegen is daarom geen duurzame oplossing. De omzetting moet begrensd en streamend worden uitgevoerd.

## Doel

Bouw een Amsterdam-importpakket uit het bestaande gevalideerde `full-subset.ndjson`, zonder dat het geheugengebruik evenredig groeit met het totaal aantal records, met behoud van:

- bestaande CSV-contracten;
- bestaande geometrie-voorkomenkoppeling;
- deterministische tellingen en checksums;
- dezelfde GO/STOP-regels;
- volledige fout- en quarantainebewijzen;
- nul databasewrites tijdens pakketvoorbereiding.

## Harde grenzen

- Geen database-, Supabase-, CRM-, Edge Function- of productiewrite.
- Geen nieuwe landelijke download of Amsterdam-extractie.
- Geen wijziging van het bestaande databasecontract.
- Geen versoepeling van geometrie-, relatie- of manifestvalidatie.
- Geen automatische import of activatie na een eventueel GO-besluit.

## Oorzaak in de huidige implementatie

De huidige route bouwt achtereenvolgens volledige collecties op voor onder andere:

1. alle geparste BAG-records;
2. alle batches en daarna opnieuw een `flatMap`-kopie;
3. alle voorkomenobjecten;
4. het volledige stagingmodel;
5. relatiesets en geometriekoppelstructuren;
6. volledige CSV-inhoud via `map(...).join('\n')`.

Daardoor zijn meerdere miljoenenrecordsrepresentaties gelijktijdig resident.

## Doelarchitectuur

### Fase A — streamende normalisatie naar tijdelijke spoolbestanden

Lees `full-subset.ndjson` regel voor regel en schrijf per geldig record compacte, genormaliseerde regels naar tijdelijke bestanden:

- `voorkomens.spool.ndjson`;
- `relaties.spool.tsv`;
- `geometrieen.spool.ndjson`;
- `object-status.spool.tsv`;
- `adapter-fouten.jsonl`.

Bewaar geen volledige recordverzameling in het geheugen. Houd uitsluitend tellingen, hashstatus en een begrensde batchbuffer bij.

### Fase B — deterministisch extern sorteren en groeperen

Sorteer tijdelijke bestanden op stabiele sleutels met de runner-tooling, onder expliciete locale:

```text
LC_ALL=C
```

Groepeer voorkomens per `objecttype + identificatie` om het actuele voorkomen vast te stellen en meerdere actuele voorkomens te signaleren. Dedupliceer relaties extern op de bestaande samengestelde relatiesleutel.

### Fase C — streamende definitieve CSV-export

Schrijf `objecten.csv`, `voorkomens.csv`, `relaties.csv`, `geometrieen.csv` en quarantainebestanden via write streams. Respecteer backpressure en bouw geen volledige CSV-string in het geheugen.

Voor geometriekoppeling wordt per objectgroep uitsluitend de minimale kandidatenlijst geladen. De volledige kandidatenindex blijft niet resident.

### Fase D — incrementeel bewijs

Bereken tijdens het schrijven per bestand:

- aantal regels;
- aantal bytes;
- SHA-256;
- contracttellingen;
- adapter-, staging- en geometrieafwijkingen.

Schrijf pas daarna `manifest.json` en `importpakket-manifest.json` en voer de bestaande GO/STOP-evaluatie uit.

## Implementatievolgorde

1. Introduceer een afzonderlijke Amsterdam-streamingexporter; verander de bestaande Assen-exporter niet.
2. Voeg kleine synthetische pariteitstests toe die de streamingoutput byte-voor-byte vergelijken met de bestaande exporter.
3. Voeg tests toe voor dubbele voorkomen-ID's, meerdere actuele voorkomens, relatiededuplicatie en ontbrekende/ambigue geometriekoppelingen.
4. Voeg een middelgrote schaaltest toe met streng geheugendoel.
5. Koppel de handmatige herstelworkflow pas na groene pariteit aan de streamingexporter.
6. Voer opnieuw uitsluitend de read-only pakketvoorbereiding uit op artifact-run `31026164539`.
7. Beoordeel manifest, tellingen, checksums en GO/STOP afzonderlijk.
8. Vraag pas daarna expliciete toestemming voor een eventuele import naar BAG-shadowproject `xfygspvpeugxowxbcvnm`.

## Acceptatiecriteria

De BUILD is gereed wanneer:

- synthetische output semantisch en waar vereist byte-identiek is aan de bestaande exporter;
- alle bestaande geometriekoppelregels behouden blijven;
- piekheap niet lineair meegroeit met de input en aantoonbaar ruim onder de GitHub-runnerlimiet blijft;
- 3.037.017 records volledig kunnen worden verwerkt;
- beide manifesten aanwezig en intern consistent zijn;
- iedere outputfile een telling, bytegrootte en SHA-256 heeft;
- het GO/STOP-besluit reproduceerbaar is;
- het rapport expliciet `database_write_uitgevoerd=false` bevat.

## Niet doen

- Geen nieuwe poging met alleen een hogere heaplimiet.
- Geen importpakket opbouwen via Vitest-workers.
- Geen volledige arrays of `map().join()` over Amsterdam-output.
- Geen database gebruiken als tijdelijke verwerkingsruimte.
- Geen gedeeltelijke bestanden als geldig importpakket publiceren.
