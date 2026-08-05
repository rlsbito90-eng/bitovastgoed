# BUILD 2A.5 — Amsterdam full-subset en shadow-importvoorbereiding

Deze BUILD sluit uitsluitend repositorymatig de kloof tussen de acht gevalideerde
metadata-artifacts van workflowrun `30999148684` en een later, apart goed te keuren
Amsterdam-import naar het BAG-shadowproject. **Er is in deze BUILD geen databasewrite
uitgevoerd en geen Supabase-project benaderd.**

## Drie strikt gescheiden artefactsoorten

| Soort | Inhoud | Gebruik |
| --- | --- | --- |
| **Bewijsmetadata** | Alleen `[primaire identificatie, gerelateerde identificaties]` per chunk, plus hashes | Validatie en closure; geen import |
| **Full-subset** | Volledige XML-standrecords van uitsluitend de geselecteerde identificaties, met bronpad, als NDJSON | Voeding voor de omzetting |
| **Importpakket** | CSV's per stagingtabel, quarantainebestand, checksums en manifest | Later, apart goedgekeurd te importeren |

De bewijsmetadata bevat nooit XML. De full-subset is nooit direct importinvoer voor de
database. Het importpakket is nooit een tweede datamodel: het gebruikt de bestaande
parser-, staging- en geometriekoppelingslogica van 2A.1/2A.2.

## Onderdelen

1. `src/lib/bag/amsterdamMetadataIndex.ts` — fail-closed samenvoeging van exact
   `chunk-01` t/m `chunk-08`: elke chunk precies één keer, gelijke `bron_sha256` en
   `manifest_sha256`, herberekende `metadata_sha256` per chunk tegen het validatierapport,
   geen overlappende brononderdelen, status uitsluitend `metadata_chunk_validated`.
   Output: één compacte metadata-index (`metadata-index.tsv`/`.json`, met `indexSha256`)
   en één bewijsrapport (`metadata-bewijs.json`).
2. `src/lib/bag/amsterdamClosure.ts` — deterministische fixed-point closure met seed op
   gemeentecode `0363`, expliciete `maximumPasses` en STOP bij non-convergentie.
   Bewijsrapport met seeds, records, passes, groei per pass, geselecteerde IDs en
   `selectieChecksum`.
3. `scripts/bag/extract-amsterdam-full-subset.py` — full-subset extractor tegen exact
   dezelfde officiële landelijke bron. Downloadt zelf niets; bronpad is expliciete invoer.
   Dwingt `bron_sha256` exact af op
   `fe2c5b7d7a264dd74ca7bfee72e7edd07d43dd99a90a34c8317e21ab6d79335c`, leest volledige
   XML-records en schrijft uitsluitend geselecteerde records met bronpad in NDJSON.
   Bewijs: objecttypen, prefixverdeling, recordaantallen, parsefouten en outputchecksum.
   Fail-closed bij 0 Amsterdamrecords, parsefouten of hashafwijking.
4. `scripts/bag/bereid-amsterdam-import-voor.ts` + `src/lib/bag/amsterdamImportPakket.ts` —
   omzetting naar de bestaande PostGIS-contracten via `exporteerAssenNaarPostgisCsv`
   (nu met `datasetVersie`/`scopeCode` als optie) en een manifest met aantallen per
   bestand/tabel, checksums, quarantaine-aantallen, ontbrekende en ambigue
   geometriekoppelingen en schema-/contractversie. STOP bij dataverlies, ontbrekende
   relaties, ambigue koppelingen, geometrieverlies of quarantaine.
5. `.github/workflows/bag-amsterdam-full-subset.yml` — handmatig startbare workflow met
   exacte approval-input `GENERATE_AMSTERDAM_FULL_SUBSET`, gebruik van uitsluitend
   workflowrun `30999148684` (of een expliciet meegegeven run/artifact), herdownload van
   de officiële bron met hashafdwinging, diskruimte- en timeoutcontroles,
   `permissions: contents read` + `actions read`, geen Supabase-secrets, en publicatie van
   full-subset, importpakket en gezamenlijk GO/STOP-rapport met 30 dagen retentie.

## Gerichte tests

`src/lib/bag/amsterdamMetadataIndex.test.ts`, `src/lib/bag/amsterdamClosure.test.ts`,
`src/lib/bag/amsterdamImportPakket.test.ts` en
`src/test/bag/amsterdamFullSubsetExtractor.test.ts` dekken: ontbrekende en dubbele chunk,
bron- en manifesthashdrift, metadatahashdrift, overlappende brononderdelen, afwijkende
status, closureconvergentie en non-convergentie, ontbrekende seeds, full-subset
hashdrift, 0 Amsterdamrecords, parsefout en alle STOP-condities van het importmanifest.

## Exacte vervolgstap (nog niet uitgevoerd)

1. Draai de workflow met approval `GENERATE_AMSTERDAM_FULL_SUBSET`.
2. Controleer in `go-no-go.md` dat het besluit `GO` is en `databaseImportUitgevoerd`
   `false` blijft.
3. Pas daarna, in een aparte BUILD met eigen approvalphrase, een import uit tegen
   **uitsluitend** BAG-shadowproject `xfygspvpeugxowxbcvnm`, op het private
   schemakandidaat van 2A.3B/2A.4A. Productie `ljudxyrqoifhfikueric` en CRM-shadow
   `wzkhmjuasyuvzhhycnym` blijven buiten scope.
4. Kadaster blijft volledig handmatig en buiten scope.

Na deze BUILD is nog geen enkele databasewrite uitgevoerd.
