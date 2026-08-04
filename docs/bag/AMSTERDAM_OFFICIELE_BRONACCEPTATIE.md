# Amsterdam uit het gratis landelijke BAG Extract

## Doel

Gebruik uitsluitend de gratis officiële maanddownload van het landelijke BAG Extract als bron en produceer daaruit een controleerbare Amsterdam-subset voor scope `0363`.

Officiële bron:

`https://service.pdok.nl/kadaster/adressen/atom/v1_0/downloads/lvbag-extract-nl.zip`

## Kosten- en infrastructuurgrens

Deze fase:

- bestelt geen betaald gemeentelijk Extract;
- maakt geen nieuw Supabase-project of branch;
- wijzigt geen Supabase-data;
- activeert geen betaalde Vercel-functie;
- gebruikt alleen een handmatig gestarte GitHub Actions-run;
- publiceert uitsluitend kleine bewijsrapporten als artifact.

De run verbruikt wel GitHub Actions-rekentijd en downloadverkeer. Er wordt geen betaalde upgrade gestart. Bij een overschreden GitHub-limiet stopt de run in plaats van automatisch kosten te maken.

## Verwerkingsstrategie

Het landelijke ZIP-bestand is circa meerdere gigabytes groot. Daarom wordt het niet volledig uitgepakt.

1. Download de officiële landelijke ZIP.
2. Controleer ZIP-integriteit en registreer SHA-256.
3. Open XML en geneste ZIP-bestanden sequentieel.
4. Selecteer alle records met een primaire BAG-identificatie die begint met `0363`.
5. Breid de selectie in meerdere passes uit met records die via BAG-identificaties zijn gekoppeld.
6. Schrijf uitsluitend de relatieclosure voor Amsterdam als tijdelijk NDJSON.
7. Valideer scope, recordaantallen en parsefouten.
8. Bereken een conservatieve capaciteitsraming.
9. Verwijder het landelijke ZIP-bestand en de tijdelijke subset vóór artifact-upload.

## Handmatige start

Workflow:

`.github/workflows/bag-amsterdam-officiele-bronacceptatie.yml`

Vereiste bevestiging:

`EXTRACT_BAG_AMSTERDAM_0363_FROM_NL`

Er zijn geen bron-URL- of checksumsecrets nodig. De actuele checksum wordt tijdens de run berekend en als bewijs vastgelegd. Die checksum moet vóór de latere database-import expliciet worden vastgezet.

## Resultaten

Het artifact bevat alleen:

- bronchecksum;
- bronbestandsgrootte;
- extractierapport per closure-pass;
- objecttype- en prefixaantallen;
- scopevalidatie;
- capaciteitsraming;
- Markdown-rapport.

Het landelijke BAG Extract en het tijdelijke Amsterdam-NDJSON worden niet als artifact opgeslagen.

## Go/no-go na de run

**GO voor importvoorbereiding** wanneer:

- ZIP-integriteit groen is;
- geen XML- of ZIP-parsefouten bestaan;
- Amsterdamse records aanwezig zijn;
- relatieclosure convergeert;
- scopevalidatie groen is;
- de benodigde vrije shadowdatabasecapaciteit beschikbaar is.

**NO-GO** bij onverwachte scopevervuiling, parsefouten, onvoldoende capaciteit of een niet-convergerende selectie.

## Nog niet uitgevoerd

Deze BUILD downloadt of importeert tijdens PR-validatie geen landelijke BAG-data. De grote bronrun begint pas na merge en een expliciete handmatige workflowstart. Amsterdam blijft tot na database-import, integriteitscontrole en afzonderlijke allowlist-activatie niet querybaar.
