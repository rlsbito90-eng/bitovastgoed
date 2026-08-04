# BAG Amsterdam — read-only capaciteits- en broninventarisatie

Status: voorbereiding; geen import uitgevoerd.
Scope: Amsterdam, gemeentecode `0363`.
Shadowproject: `xfygspvpeugxowxbcvnm`.

## 1. Officiële bronroute

De primaire bron blijft het officiële BAG Extract van het Kadaster. Een gemeentelijk extract bevat de LV-BAG-gegevens van de gekozen gemeente en wordt als XML geleverd. De Amsterdam-tranche mag uitsluitend worden gestart met een herkenbaar bronpakket, leverdatum, checksummanifest en expliciete gemeentecode `0363`.

Geen BAG API-crawl gebruiken als vervanging voor het volledige extract. Geen Kadaster-eigenaargegevens automatiseren.

## 2. Gemeten Assen-baseline

Read-only meting op het shadowproject:

| Kerntabel | Rijen | Totale ruimte |
|---|---:|---:|
| `bag_staging.objecten` | 128.745 | 24 MB |
| `bag_staging.voorkomens` | 168.047 | 117 MB |
| `bag_staging.relaties` | 160.351 | 44 MB |
| `bag_staging.geometrieen` | 122.375 | 57 MB |
| **Totaal** | **579.518** | **circa 242 MB** |

De codebaseline gebruikt exact `253.902.848` bytes. Voor een nieuwe scope wordt minimaal tweemaal de geraamde tabel- en indexruimte als vrije ruimte verlangd, zodat staging, validatie, indexbouw en rollback niet op dezelfde minimale marge concurreren.

## 3. Amsterdam-raming

De definitieve raming mag pas worden ingevuld nadat de officiële Amsterdam-bronbestanden lokaal zijn geïnspecteerd en de objecttelling is vastgelegd. `raamBagScopeCapaciteit('0363', verwachteObjecten)` schaalt de bewezen Assen-verhoudingen voor:

- objecten;
- voorkomens;
- relaties;
- geometrieën;
- tabel- en indexruimte;
- aanbevolen vrije ruimte.

Boven 2.000.000 geraamde stagingrijen is tranchegewijze import verplicht. Dit is een operationele veiligheidsgrens, geen uitspraak over een technische limiet van PostgreSQL.

## 4. Go/no-go vóór import

Amsterdam-import is uitsluitend toegestaan wanneer alle voorwaarden waar zijn:

1. officiële bronbestanden, leverdatum, gemeentecode en checksums zijn gevalideerd;
2. broninventarisatie bevat werkelijke tellingen per objecttype;
3. beschikbare shadowruimte is minimaal gelijk aan de geraamde ruimte maal veiligheidsfactor 2;
4. rollback- en herstartprocedure is vooraf getest;
5. Amsterdam staat tijdens staging nog niet in de clientallowlist;
6. Amsterdam staat tijdens staging nog niet in de serverallowlist;
7. datasetversie-identiteit is uniek en herleidbaar;
8. volledigheid, duplicaten, geometriegeldigheid en quarantaine zijn als aparte acceptatiecontroles vastgelegd.

## 5. Importvolgorde

1. bronpakket buiten Supabase valideren;
2. manifest en tellingen genereren;
3. capaciteitsraming en vrije ruimte controleren;
4. staging laden met scope `0363`, zonder queryactivatie;
5. integriteits- en quarantainecontroles uitvoeren;
6. queryservice read-only tegen expliciete Amsterdam-scope testen;
7. pas na acceptatie client- en serverallowlist activeren;
8. Amsterdam als commerciële standaardscope gebruiken;
9. Assen behouden als technische referentie.

## 6. Nog open vóór Amsterdam BUILD

- werkelijk Amsterdam-bronpakket verkrijgen;
- exacte brongrootte en tellingen vastleggen;
- actuele vrije databasecapaciteit en creditruimte bevestigen;
- importduur meten met een representatieve tranche;
- Edge Function-pagination en responstijd tegen Amsterdam-volume beproeven;
- afzonderlijke expliciete go/no-go vastleggen.
