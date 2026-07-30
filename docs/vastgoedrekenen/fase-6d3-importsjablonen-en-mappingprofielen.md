# Vastgoedrekenen — Fase 6D.3 importsjablonen en mappingprofielen

## Doel

Fase 6D.3 maakt de gecontroleerde bronimport praktisch herhaalbaar zonder nieuwe marktwaarden of financiële aannames toe te voegen.

De fase levert:

- een leeg CSV-importsjabloon;
- een Excelimportsjabloon met instructies en actieve keuzecodes;
- herbruikbare kolommappingprofielen per bron of leverancier;
- transparante toepassing en archivering van mappingprofielen.

## Sjablonen

### CSV

Het CSV-sjabloon bevat uitsluitend de actuele importkopregel. Er staan geen voorbeeldregels of bedragen in.

### Excel

Het Excelbestand bevat vier tabbladen:

1. `_Instructies` — gewone-taaluitleg en veiligheidsgrenzen;
2. `Kengetallen` — leeg gegevensblad met alleen de importkopregel;
3. `_Keuzelijsten` — actieve technische taxonomiecodes en labels;
4. `_Categorieen_en_koppelingen` — geldige categorieën, scenario-koppelingen en profielbanden.

Het tabblad `Kengetallen` bevat bewust geen voorbeeldmarktwaarden. Daardoor kan een voorbeeld niet per ongeluk als echte bronset worden geïmporteerd.

## Mappingprofielen

Een mappingprofiel bewaart:

- profielnaam;
- optionele bron- of leveranciersnaam;
- per importveld de naam van de bronkolom;
- maker en tijdstippen;
- actief- of archiefstatus.

Er worden geen kengetalwaarden, bandbreedten, bronbestanden of scenario-invoer in een mappingprofiel opgeslagen.

Kolomnamen worden opgeslagen in plaats van kolomnummers. Wanneer een leverancier dezelfde kolommen in een andere volgorde aanlevert, kan het profiel opnieuw worden toegepast.

## Automatische toepassing

Een profiel wordt alleen automatisch toegepast wanneer:

- de bron- of leveranciersnaam exact overeenkomt met het gekozen bronpakket;
- alle opgeslagen bronkolommen in het geselecteerde werkblad aanwezig zijn.

Anders blijft automatische kolomherkenning actief en moet de gebruiker een profiel bewust selecteren. Iedere toegepaste mapping blijft zichtbaar en aanpasbaar vóór import.

## Opslag en beveiliging

De tabel `vastgoedrekenen_bronimport_mapping_profielen` heeft:

- RLS;
- makergebonden mutatierechten;
- een actor-trigger die `created_by` aan de werkelijk aangemelde gebruiker bindt;
- een databasecheck op toegestane velden, verplichte primaire mappings en unieke bronkolommen;
- geen directe deletepolicy.

Archiveren zet `actief` op `false`. Reeds uitgevoerde importaudit blijft zelfstandig intact, omdat iedere import zijn feitelijk gebruikte kolommapping al in `vastgoedrekenen_bronimport_runs` bewaart.

## Niet in deze fase

- inhoudelijke marktdata;
- voorbeeldbouwkosten, huren, yields of verkoopwaarden;
- automatische goedkeuring van bronpakketten;
- automatische toepassing op scenario’s;
- automatische correctie van bronbestanden;
- mapping op basis van onbetrouwbare fuzzy herkenning;
- PDF- of OCR-import.
