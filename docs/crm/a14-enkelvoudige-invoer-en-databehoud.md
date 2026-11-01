# CRM A14 — één keer classificeren, bestaande data behouden

## Aanleiding en feitelijke nulmeting (1 november 2026)

De CRM-relatie heeft zowel `type_partij` (oude, verplichte classificatie) als `partijprofiel` (A13, optioneel).
Het oude hoofdtype telt 114 keer 'belegger' van de 135 relaties; dit is deels de bestaande
standaardwaarde en is **niet** geschikt om alle relaties automatisch als belegger te herclassificeren.
In de huidige database hebben één relatie een ingevuld partijprofiel en één relatie
vastgoedstrategieën; één relatie heeft expliciete commerciële rollen.
Er zijn zeven zoekprofielen verdeeld over zes relaties. 23 relaties bevatten
bestaande vrije aankoopcriteriatekst. De tellingen zijn momentopnames; geen individuele klantdata opgenomen.

## Gegevensmodel — leidende betekenis

| Informatie | Leidend veld/onderdeel | Wat níet doen |
|---|---|---|
| Aard onderneming/partij | `relaties.partijprofiel` | Niet opnieuw als bewerkbaar `type_partij` vragen |
| Rol bij zaken/doorgeven van aanbod | `relaties.commercial_roles` | Niet uit partijprofiel een koper of mandaat afleiden |
| Algemene investeringsaanpak | `relaties.vastgoed_strategieen` | Niet gelijkstellen aan concrete matchcriteria |
| Concrete koopwensen per zoekrichting | `zoekprofielen` | Niet kopiëren naar nieuwe partij- of strategievelden |
| Historisch hoofdtype/compatibiliteit | `relaties.type_partij` | Niet voor bestaande relaties overschrijven of droppen |
| Bestaande basis-criteria en aankooptekst | Reeds bestaande relatievelden | Niet massaal migreren/weggooien zonder match-audit |

`NULL` bij partijprofiel of strategie betekent **onbekend**, niet 'belegger' of 'geen interesse'.

## A14 — geïmplementeerde eerste veilige UX-fase

1. De tweede bewerkbare hoofdtype-keuze verdwijnt uit het relatieformulier. Bij
   een bestaande relatie is de historische waarde alleen via een inklapbaar,
   **alleen-lezen** overzicht te bekijken.
2. In het relatieoverzicht wordt het ingevulde partijprofiel de primaire
   classificatie. Zonder partijprofiel blijft het historische hoofdtype
   als fallback zichtbaar, zonder dat we data terugschrijven.
3. Bij **nieuwe** relaties wordt de benodigde legacy-classificatie technisch
   afgeleid van de *expliciet geselecteerde* partijclassificatie:
   - belegger/ontwikkelende belegger → belegger
   - ontwikkelaar → ontwikkelaar
   - makelaar/bemiddelaar → makelaar
   - vastgoedeigenaar → eigenaar
   - vastgoedondernemer/overig → overig
   Is geen profiel gekozen, dan blijft de bestaande standaard voor de legacy
   databasekolom gelden (geen automatische aanvulling van het nieuwe profiel).
4. **Bestaande** relaties behouden ongewijzigd `type_partij`, ook bij
   het aanpassen van hun profiel. Contactpersonen, `commercial_roles`,
   strategieën, basiscriteria, zoekprofielen en matches krijgen geen backfill.

## Expliciet buiten scope: tweede harmonisatiefase

De applicatie bevat nog `relaties.asset_classes`, `property_type_ids`, regio,
budget en een vrije aankoopcriteriatekst naast `zoekprofielen`. De oudere
R2-matchingadapter gebruikt basiscriteria als terugvalroute en kiest zo nodig
een actieve zoekprofielroute. Deze velden nu verbergen of automatisch kopiëren
kan reële bestaande matches veranderen. Eerst onderzoek en gecontroleerde
vergelijking op synthetische cases, daarna pas bepalen welke invoer standaard
naar Zoekprofielen verhuist en hoe legacy-gegevens bereikbaar blijven.

Hetzelfde geldt voor 'Makelaar' als partijprofiel versus 'makelaar' als
commerciële rol: de ene duidt de aard van de partij aan, de ander diens rol.
Geen automatische mandaat- of koperaanname.

## Releasevoorwaarden

- Geen nieuwe databasekolom/migratie nodig.
- Geen productierecords wijzigen en geen automatische migratie.
- Nieuwe branch met Vercel-previewbuilds uitgeschakeld; geen automatische merge.
- TypeScript, formulier- en classificatietests plus regressietests controleren.
- Bij livegang expliciete toestemming voor `main` en productiecontrole; één
  Vercel-build, geen aparte previews.


## A14.2 — nieuwe profielopties en directe bewerking in het profiel

- **Ontwikkelende belegger** bestond al; blijft precies één profieloptie.
- Nieuwe profielopties: **Fonds**, **Family office**, **Buitenlandse belegger**.
- Fonds en Family office komen ook voor in het historisch gemengde veld
  `investeerder_subtype` (naast onder meer BV/NV/CV). Daarom wordt in het
  relatieformulier voortaan alleen de **rechtsvorm** (BV/NV/CV) gevraagd; eerder
  ingevulde categorieën worden zichtbaar en ongewijzigd bewaard. Op termijn
  moet rechtsvorm los worden opgeslagen van de algemene classificatie.
- In de relatiepagina is een eerste inline-sectie voor Partijprofiel en
  Vastgoedstrategieën toegevoegd. Bewerk ter plekke, expliciet opslaan of
  annuleren. De opslagpatch raakt uitsluitend gewijzigde profielvelden en
  laat commerciële rollen, overige relatiegegevens, contactpersonen en
  zoekprofielen ongemoeid.
- De nieuwe profielen vragen een aparte **nog niet uitgevoerde** CHECK-uitbreiding:
  `20261101130000_a14_extend_partijprofiel_values.sql`.
- Bestaande relaties worden niet automatisch geclassificeerd. Latere
  herclassificatie mag na een voorstelaudit per relatie en controle van de
  bestaande gegevens, met log en ongedaanmaakmogelijkheid.

## Profielpagina — nog te implementeren voor volledig direct bewerken

De relatiepagina toont al contactpersonen, algemene contactgegevens,
vastgoedvoorkeuren, investeerdersinformatie, vestiging, zoekprofielen,
pipeline, deals, taken, matches en contactmomenten. Niet elk opgeslagen
veld is zichtbaar en de meeste velden zijn nog niet op hun plaats bewerkbaar.

**Gewenste eindtoestand**: alle relevante gegevens in logisch ingedeelde,
ook op mobiel leesbare secties. Lege velden hebben duidelijke placeholders,
niet stilzwijgend verborgen informatie. Elk veld of elke groep krijgt
inline bewerken + opslaan/annuleren, zonder dat een grote modal nodig is.

In de volgende fase: contactpersonen met functie/primair/beslisser/kanalen;
bedrijfsgegevens en vestiging; vastgoed- en koopcriteria; investerings- en
kapitaalgegevens; zoekprofielen en specifieke regio/bedrag/huur/wensen;
notities, communicatie, NDA, bron, opvolging en overige CRM-informatie.
Uit relationele modules zoals pipeline/deals/taken blijven hun eigen
autorisatie- en businessregels leidend; direct bewerken mag die niet
omzeilen. Matching-uitkomsten zijn berekend, dus geen handmatige veldedit.

Voorwaarde bij iedere fase: **geen dubbele bron**, kleine gerichte
wijzigingspatches, niet onbedoeld leegmaken, expliciete foutmelding,
gebruikerscontrole en regressietests voor contactpersonen/zoekprofielen.
