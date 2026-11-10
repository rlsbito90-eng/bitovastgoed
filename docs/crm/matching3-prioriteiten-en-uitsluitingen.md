# Matching 3.0 — belang en uitsluitingen per acquisitiecriterium

Status: ontwerp en pure beoordelingskern; **niet gekoppeld aan productie-CRM**.

## Functioneel doel

Bito CRM moet voor ieder investeringsprofiel en optionele afzonderlijke zoekrichting kunnen vastleggen:
- **Harde eis**: object moet aantoonbaar voldoen; een aantoonbare afwijking is *afwijkend*.
- **Voorkeur**: object blijft kandidaat als criterium afwijkt; relevantie en onderbouwing wijzigen.
- **Uitsluiting**: een aantoonbare match met de uitgesloten eigenschap is *afwijkend*.
- **Niet bekend**: geen instelling van de koper, maar een beoordeling van de objectdata; bij relevante ontbrekende data wordt *te verifiëren*.

Elk criterium krijgt een eigen sterkte. Geen algemene verplichting om alle regio- of vastgoedvoorkeuren tegelijk dezelfde sterkte te geven.

## Eén invoer, geen dubbele registraties

Bij het invullen van een investeringsprofiel:
1. Voeg in één zoekveld een plaats/gemeente/provincie toe; bepaal per selectie *Harde eis*, *Voorkeur* of *Uitsluiten*. Het label *Plaats* versus *Gemeente* blijft zichtbaar.
2. Leg ook bij vastgoedtype, verhuurstatus, strategie, bedrag, rendement en omvang vast wat werkelijk is bedoeld. Voor onder-/bovengrenzen is de keuze *Harde eis* of *Voorkeur*; een uitgesloten getalsbereik moet als expliciete minimum- of maximumgrens worden gemodelleerd.
3. Behoud letterlijke toelichtingen van websiteformulieren, e-mails of gesprekken als **bron**. Interpreteer vrije tekst niet zelfstandig als harde knock-out.
4. Bestaande relaties/zoekprofielen behouden ongewijzigd hun betekenis. De eerste migratie mag geen impliciete uitsluitingen creëren. Een oude harde afkap blijft tot het profiel opnieuw is gecontroleerd volgens het bestaande beleid gehandhaafd.

## Voorgesteld databestand

Per relatie en aanvullend zoekprofiel één JSONB-veld `criterium_regels` met een versie en lijst:
`{id, veld, waarde, sterkte, actief, bron, bevestigd_op}`.

Veldwaarden zijn expliciet getypeerd; geen vrijetekstoperators voor geautomatiseerde filtering.
Mogelijke velden zijn eerst: provincie, gemeente, plaats, vastgoedtype, verhuurstatus, strategie,
koopprijs_min, koopprijs_max, bar_min, oppervlakte_min en oppervlakte_max.

Aanvullende velden zoals WALT, huuropbrengst, achterstanden, perceel, vergunningen, aantal units,
dealstructuur en ontwikkelpotentie worden pas automatisch getoetst als de objectgegevens daarvoor
een verifieerbaar gestructureerd veld hebben.

## Matchingvolgorde

1. Controleer of het object überhaupt aanbiedbaar is en of de relatie niet al actief gekoppeld is.
2. **Uitsluitingen:** bewezen uitsluiting = *afwijkend*. Onbekende bestuurlijke gemeente = *te verifiëren*, niet ten onrechte een uitsluiting.
3. **Harde eisen:** binnen een groep gelijksoortige positieve waarden geldt OF (Breda OF Tilburg); tussen verschillende criteria geldt EN (gewenste locatie EN budget EN vastgoedtype). Ontbrekende data = *te verifiëren*.
4. **Voorkeuren:** uitsluitend gebruikt voor rangschikking en onderbouwing. Een voorkeurafwijking is geen knock-out.
5. Toon bron en toelichting per regel, inclusief specifieke criteria die ontbreken.
6. Een positieve match is uitsluitend een voorstel; contact- en kandidaatbeslissingen blijven bij de gebruiker.

## Lastige voorbeelden en verwachte uitkomst

- Nederland breed + voorkeur Noord-Brabant: een pand in Gelderland blijft mogelijk passend.
- Gemeente De Ronde Venen uitgesloten + object Mijdrecht met onbekende geverifieerde gemeente: **te verifiëren**, niet automatisch uitgesloten.
- Breda OF Tilburg harde eis + object Tilburg: **voldoet**.
- Horeca uitgesloten + object met vastgesteld vastgoedtype horeca: **afwijkend**.
- Budget maximaal €1.000.000 als voorkeur + object €1.050.000: voorkeur wijkt af; niet automatisch uitgesloten.
- Minimaal 8% BAR als harde eis + BAR onbekend: **te verifiëren**.
- Minimaal 8% BAR als harde eis + geverifieerde BAR 7,5%: **afwijkend**.
- Uitgesloten huurachterstanden + betalingshistorie niet beschikbaar: **te verifiëren**, geen conclusie uit contractuele huur.

## Veiligheids- en migratievoorwaarden

- Een JSONB-configuratie mag bestaande velden niet stilzwijgend overschrijven of verwijderen.
- Behoud historisch kandidaatschap, afwijzingsredenen en handmatige overrides.
- Alleen een geverifieerde locatie mag een bestuurlijke gemeente of radius uitsluiten.
- Wees terughoudend met positieve betrouwbaarheidsscores wanneer objectdata ontbreken.
- Geen auto-verzending van IM/teaser, biedingen of pipelinewijzigingen.
- Eerst vergelijking op bestaande relatie-objectcombinaties; daarna pas nieuwe regels activeren in de live R2/legacy matching.
- Opslag en interface volgen pas na stabiele tests van de pure evaluator en een aparte database-migratie.
