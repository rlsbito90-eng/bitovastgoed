# A15 — classificatie-werkvoorraad (read-only nulmeting)

**Datum:** 1 november 2026  
**Databron:** productie Supabase, geaggregeerde SELECT op `public.relaties`;
alleen actieve relaties `soft_deleted_at IS NULL`.  
**Geen namen, e-mails of contactgegevens vastgelegd. Geen mutaties.**

| Beoordelingsgroep | Actieve relaties | Verwerking |
|---|---:|---|
| Bestaand nieuw partijprofiel | 1 | Behouden, niet overschrijven |
| Expliciete oude investeerderscategorie Fonds | 1 | Alleen voorstel Fonds, eerst broncontrole |
| Expliciete oude investeerderscategorie Family office | 0 | Geen automatische aanname |
| Oud hoofdtype Ontwikkelaar | 9 | Voorstel Ontwikkelaar, kan ontwikkelende belegger zijn |
| Oud hoofdtype Makelaar | 4 | Geen automatisch voorstel: makelaar of bemiddelaar controleren |
| Oud hoofdtype Eigenaar | 1 | Geen automatisch voorstel: eigendom zegt niet genoeg |
| Overige oude hoofdtypen, vaak default Belegger | 76 | Eerst dossier/zoekprofiel of contacthistorie bekijken |
| **Totaal actief** | **92** | |
 
**10 concrete controlevoorstellen, 81 nadere onderzoeken, 1 reeds
geclassificeerd.** Voorstel betekent niet bevestigde categorie.
Bij onduidelijkheid blijft `partijprofiel=NULL`.

## Samenhang met Matching

Een expliciet partijprofiel vertelt wat voor bedrijf of partij het is,
geen mandaat en niet automatisch dat zij economische koper wordt.
Een bestaand actief Zoekprofiel kan een passende contactroute bieden,
ook voor makelaars/bemiddelaars zonder formele bevestiging.
De A15-matchingvergelijking biedt een gedetailleerde read-only lijst
per object en relatie met weggevallen, toegevoegde en gewijzigde routes;
ook koperverwijzingen, matchkwalificaties, bevestigingsstatus en beste
zoekroute zijn afzonderlijk zichtbaar.

## Volgorde van beoordeling

1. Controleer de 10 expliciete historische voorstellen (Fonds / Ontwikkelaar)
   en leg de onderbouwing vast in de primaire relatie.
2. Beoordeel de 5 oude makelaar-/eigenaargevallen. Geen koperrol toevoegen
   vanwege een bemiddelaarrelatie.
3. Prioriteer binnen de 76 overige dossiers eerst relaties met actieve,
   concrete Zoekprofielen of actuele transacties. Daar is de commerciële
   impact van verkeerde classificatie het grootst.
4. Vergelijk vóór/na de candidate-diff, inclusief verloren routes,
   koperidentiteiten en afwijkingen in de bestaande pipeline.
5. Verwijder daarna, via een afzonderlijk migratieplan en expliciet akkoord,
   de dubbele rol- en oude hoofdtypevelden.

## Grenzen

Deze controle heeft geen individuele relaties hergeclassificeerd,
geen commerciële rollen opgeschoond, geen historische zoekcriteria
verplaatst en geen productiecode of matching aangepast.
De nulmeting geldt uitsluitend voor de actuele stand op deze datum.

## Aanvullende dossiercontrole: identiteit en prioriteit

De eerste mechanische selectie uit de oude velden gaf 10 mogelijke voorstellen.
Een gerichte read-only dossiercontrole constateerde dat **twee** van de negen
oude ontwikkelaarsrecords een onbruikbare bedrijfsnaam hebben (leeg of
`Onbekend`). Eén van die records heeft bestaande contact-/pipelinehistorie.

Het A15-reviewoverzicht markeert deze twee dossiers nu **als te onderzoeken
identiteitsprobleem** in plaats van een voorstel te suggereren. Daardoor
resteert bij deze strengere toetsing:

| Status na identiteitscontrole | Aantal |
|---|---:|
| Reeds ingevuld nieuw Partijprofiel | 1 |
| Te controleren voorstellen met bruikbare partijnaam | 8 |
| Eerst onderzoeken / ontbrekend bewijs / identiteitscontrole | 83 |
| Totaal actieve relaties | 92 |

De reviewlijst prioriteert dossiers met actieve zoekprofielen en
pipelinekoppelingen, inclusief naamloze records. Aantallen uit de oude
kolommen zijn daarmee **voorselecties**, niet definitief bevestigde
classificaties. Voor de latere overgang blijft bij twijfel `NULL`
de veilige status. De huidige relaties, contacthistorie, zoekprofielen
en pipeline zijn bij deze controle niet gemuteerd.

## Prioriteit van lopende pipeline (verfijning)

De totale niet-soft-verwijderde `object_pipeline`-rijen omvatten ook
`afgevallen` en `afgerond`. Voor de A15-review is daarom een onderscheid
ingevoerd tussen:

- **Pipelinehistorie**: alle reeds geladen koppelingen, ter inzage.
- **Lopende pipeline**: koppelingen behalve `afgevallen` en `afgerond`;
  deze tellen zwaarder mee bij de volgorde van classificatiecontrole.
- **Actieve zoekprofielen**: afzonderlijk, eveneens hoge prioriteit.

De originele pipelinefasen, oude biedingen en contactmomenten worden niet
gewijzigd of verwijderd. De aanbeveling voor een partijprofiel blijft
onbevestigd, ongeacht historische contactactiviteit.
