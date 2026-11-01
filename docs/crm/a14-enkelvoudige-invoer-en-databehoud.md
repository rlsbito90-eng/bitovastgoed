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
