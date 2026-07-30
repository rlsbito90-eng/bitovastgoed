# Vastgoedrekenen Fase 6C — eerste inhoudelijke standaardregister

## Doel

Fase 6C centraliseert de exploitatie-aannames die vóór deze fase al in de CRM-code aanwezig waren. De waarden worden als kengetallen met bronstatus, peildatum, geldigheid, profielrichting en vaste classificatie beschikbaar gemaakt aan de gecontroleerde invoerprofielen uit Fase 6B.

Deze fase introduceert **geen nieuwe marktbenchmark** en wijzigt geen financiële formule.

## Bronstatus

De bron is `src/lib/vastgoedrekenen/profiles.ts`, het bestaande interne quickscanprofiel van Bito Vastgoed.

Alle 28 regels krijgen daarom:

- brontype `interne_werkhypothese`;
- betrouwbaarheid `laag`;
- peildatum en geldig-vanaf 30 juli 2026;
- vervaldatum 30 januari 2027;
- een expliciete waarschuwing dat de waarde vóór een serieuze bieding moet worden vervangen door actuele externe of projectspecifieke brondata.

De door de gebruiker aangeleverde SPRYG/Fakton-appendices blijven methodologische referenties en golden-testbronnen. De voorbeeldwaarden uit die spreadsheets worden niet als actuele marktkengetallen geïmporteerd.

## Omvang

Het pakket bevat zeven bestaande assetprofielen:

1. residentieel;
2. mixed-use;
3. retail en horeca;
4. kantoor;
5. bedrijfsruimte / light industrial;
6. logistiek;
7. zorg.

Per assetprofiel worden vier bestaande scenariovelden geregistreerd:

- leegstand;
- exploitatiekosten;
- onderhoudsreserve;
- beheerkosten.

Totaal: **7 × 4 = 28 registerregels**.

## Bandbreedte

De bestaande profielen worden als volgt vertaald:

| Registerband | Bestaand CRM-profiel |
|---|---|
| Minimum | Licht / gunstig |
| Basis | Normaal / realistisch |
| Maximum | Conservatief |

Voor deze vier kosten- en correctievelden geldt:

- Conservatief profiel gebruikt `maximum`;
- Basisprofiel gebruikt `basis`;
- Optimistisch profiel gebruikt `minimum`.

Het bestaande profiel `zwaar / risicovol` wordt bewust niet als automatische maximumband gebruikt. Dat profiel blijft beschikbaar in het bestaande handmatige/legacyspoor. Hiermee wordt voorkomen dat een uitzonderlijke stressaanname ongemerkt als reguliere conservatieve invoer wordt toegepast.

## Classificatie

Iedere standaardregel is beperkt tot:

- het bijbehorende assettype;
- projectfase `quickscan`;
- de drie invoerprofielen Conservatief, Basis en Optimistisch.

Strategie, gebied, kwaliteit, risico, complexiteit en marktomstandigheid blijven breed. Hierdoor hoeft de gebruiker die dimensies niet kunstmatig in te vullen om een bestaand algemeen exploitatieprofiel te kunnen gebruiken.

## Migratieveiligheid

De migratie:

- voegt uitsluitend ontbrekende standaardcodes toe;
- gebruikt `ON CONFLICT (code) DO NOTHING`;
- overschrijft dus geen handmatig gewijzigde registerregel;
- maakt geen scenario-snapshot;
- maakt geen profieltoepassing;
- wijzigt geen scenario-invoer of rekenuitkomst.

## Dekkingscontrole

De centrale helper `assessStandardRegisterCoverage()` controleert:

- verwacht aantal regels;
- aanwezige regels;
- actieve regels;
- verlopen regels;
- gearchiveerde regels;
- ontbrekende codes;
- complete of onvolledige dekking.

Het Beheer-scherm toont deze status en blijft benadrukken dat het standaardpakket een interne quickscanwerkhypothese is.

## Vervolg

Externe markt- en bouwkostenbronnen horen later als afzonderlijke, brongebonden registersets te worden toegevoegd. Zij moeten een duidelijke metriek, regio, prijspeil, btw-behandeling, scope en vervaldatum hebben. Zij mogen de interne quickscanset niet stilzwijgend overschrijven; toepassing blijft via scenario-snapshots verlopen.
