# BUILD 2A.1 — Officiële BAG-bronacquisitie

## Doel

Borg dat de definitieve BAG Extract-adapter uitsluitend wordt vrijgegeven op basis van lokaal geïnspecteerde officiële Kadaster-bestanden.

## Bevestigde officiële bronnen

1. XSD-totaalpakket BAG Extract: `https://developer.kadaster.nl/schemas/lvbag-extract-v20200601.zip`
2. Gemeenteproefbestand Assen (0106): officiële download vanaf de Kadaster-documentatiepagina.

Het Kadaster beschrijft het XSD-pakket als totaalpakket voor BAG Extract, GWR en IMBAG. Het officiële gemeenteproefbestand bevat een BAG Extract van Assen en is bedoeld om een applicatie in te richten en te testen.

## Uitvoerbeperking

De ZIP-bestanden konden vanuit de huidige uitvoeromgeving niet binair worden opgehaald door netwerk/DNS-beperking. Daarom zijn nog geen namespaces, bestandsnamen, XML-paden of GML-varianten uit de daadwerkelijke bestanden als bevestigd aangemerkt.

## Vrijgavevoorwaarden

Voor ieder bestand moeten worden vastgelegd:

- lokale aanwezigheid;
- bestandsgrootte;
- SHA-256-checksum;
- leesbare ZIP-structuur;
- volledige inhoudslijst;
- aanwezigheid van XSD respectievelijk XML;
- geslaagde XSD-validatie van het proefbestand.

Pas wanneer beide officiële bronnen aan deze voorwaarden voldoen, mag de officiële XML-mapping worden vrijgegeven.

## Veiligheid

- Geen automatische download met gebruikersreferenties.
- Geen secrets in repository of logs.
- Geen productie-import.
- Geen afgeleide XML-paden op basis van alleen documentatie of aannames.
- Geen promotie naar CRM-objecten.
