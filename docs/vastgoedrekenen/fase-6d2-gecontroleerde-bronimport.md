# Vastgoedrekenen — Fase 6D.2 gecontroleerde bronimport

## Doel

Fase 6D.2 voegt een gecontroleerde importstraat toe voor echte bronbestanden en projectspecifieke ramingen. De import ondersteunt CSV, XLS en XLSX, maar schrijft nooit direct na het kiezen van een bestand.

## Proces

1. Kies een regulier conceptbronpakket.
2. Selecteer een CSV-, XLS- of XLSX-bestand.
3. Kies bij Excel het relevante werkblad.
4. Controleer of de bronkolommen correct aan de registervelden zijn gekoppeld.
5. Controleer de volledige validatiesamenvatting en rijpreview.
6. Bevestig expliciet dat bronpakket, werkblad, mapping en regels zijn beoordeeld.
7. Importeer de volledige set transactioneel.

## Verplichte velden

Iedere importregel bevat minimaal:

- unieke registercode;
- naam;
- categorie;
- vaste eenheid;
- minimumwaarde;
- basiswaarde;
- maximumwaarde.

Bij een eurogrondslag is een gecontroleerde btw-behandeling verplicht.

## Optionele classificaties

De import kan daarnaast vaste codes of herkenbare labels verwerken voor:

- scenario-koppeling;
- conservatieve en optimistische profielband;
- assettype;
- strategie;
- projectfase;
- risicoklasse;
- kwaliteitsniveau;
- complexiteit;
- locatietype;
- marktomstandigheid;
- scenarioprofiel;
- officiële gebiedssleutels;
- toelichting.

Meerdere classificaties in één cel worden gescheiden met een komma, puntkomma, verticale streep of nieuwe regel.

## Append-only

De eerste importversie maakt uitsluitend nieuwe registerregels aan.

- Een bestaande registercode is een conflict.
- Een dubbele code in hetzelfde bestand is een conflict.
- Hetzelfde bestand en werkblad kunnen niet tweemaal in hetzelfde bronpakket worden geïmporteerd.
- Bestaande regels worden nooit automatisch bijgewerkt of overschreven.
- Een conflict blokkeert de volledige import.

Een gewijzigde externe bron wordt vastgelegd in een nieuwe bronpakketversie met nieuwe registercodes of via een latere, afzonderlijke revisieworkflow.

## Transactionele databasecontrole

De browserpreview is niet de definitieve veiligheidsgrens. PostgreSQL herhaalt onder meer:

- gebruiker is aangemeld;
- bronpakket bestaat, is concept en niet systeembeheerd;
- bestandstype, bestandsgrootte en SHA-256-hash zijn geldig;
- maximaal 1.000 regels;
- codes zijn uniek en bestaan nog niet;
- categorie en scenario-koppeling zijn toegestaan;
- minimum ≤ basis ≤ maximum;
- eenheid en btw-behandeling bestaan in de actieve taxonomie;
- classificatiecodes bestaan en zijn actief;
- eventuele gebiedssleutels vallen binnen de pakketgrenzen.

De functie valideert eerst alle regels. Pas daarna worden binnen dezelfde transactie de registerregels en één auditrecord toegevoegd. Iedere fout rolt de volledige transactie terug.

## Importaudit

Per geslaagde import wordt vastgelegd:

- bronpakket-ID;
- bestandsnaam en bestandstype;
- bestandsgrootte;
- SHA-256-bestandshash;
- werkblad;
- kolomkoppeling;
- validatiesamenvatting;
- aantal regels;
- uitvoerende gebruiker;
- tijdstip.

De auditregels zijn voor aangemelde gebruikers leesbaar, maar kunnen niet rechtstreeks via de client worden toegevoegd, gewijzigd of verwijderd.

## Privacy en opslag

Het geselecteerde bestand wordt in de browser gelezen. Het volledige bestand en de onbewerkte rijen worden niet in de database opgeslagen. Alleen bevestigde en genormaliseerde registerregels, bestandsmetadata en de mappingaudit worden bewaard.

## Buiten scope

- gedeeltelijk importeren van alleen geldige rijen;
- automatische correctie van conflicten;
- updates van bestaande registerregels;
- automatische pakketgoedkeuring;
- automatische toepassing op scenario’s;
- automatische marktconformiteitsbeoordeling;
- automatische indexering naar een nieuw prijspeil;
- PDF- of OCR-import.
