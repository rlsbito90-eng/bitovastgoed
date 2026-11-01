# A15 — voorstellen beoordelen en matching vergelijken (ontwerp- en testfase)

**Status:** uitsluitend op een draft ontwikkelbranch; géén productiedata gewijzigd,
geen migratie uitgevoerd, geen bulkclassificatie, geen aanpassingen in
actieve matchingregels. Alles is read-only totdat de eigenaar de gewenste
klassificaties en het effect op bestaande kandidaten heeft gecontroleerd.

## 1. Classificatievoorstellen

De Relaties-pagina toont een optioneel overzicht met **actieve** relaties
zonder gevalideerd `partijprofiel`. Deze voorstellen komen uitsluitend uit
historische, expliciete velden die de CRM-gebruiker al eerder invulde:

| Bron | Voorstel | Beoordeling |
|---|---|---|
| Historische `investeerder_subtype=family_office` | Family office | Verifiëren; niet automatisch opslaan |
| Historische `investeerder_subtype=fonds` | Fonds | Verifiëren; niet automatisch opslaan |
| Historische `type_partij=ontwikkelaar` | Ontwikkelaar | Verifiëren: kan ook ontwikkelende belegger zijn |
| Historische `type_partij=makelaar` | Onbekend | Kiezen tussen makelaar/bemiddelaar, bron controleren |
| Historische `type_partij=eigenaar` | Onbekend | Economisch eigenaar versus belegger eerst bepalen |
| Historische `type_partij=belegger` | Onbekend | **Niet betrouwbaar**, was ook de standaardwaarde |
| Buitenlands vestigingsland, zoekprofielen, strategieën, niet-gecontroleerde naam | Onbekend | Geen persoons-/organisatieclassificatie afleiden |

Er wordt **geen** `commercial_roles`, `vastgoed_strategieen` of nieuw
`partijprofiel` wegschreven. Het overzicht leidt alleen naar de bestaande
relatiepagina, waar de CRM-gebruiker via het bestaande veld Partijprofiel
de classificatie expliciet kan bevestigen. Bewijs en onzekerheid zijn zichtbaar.

## 2. Een afzonderlijke, optionele matching-dry-run

`rolMandaatAdapter` behoudt als **standaard** het bestaande routebeleid.
Een A15-testvariant kan door middel van `beleid:'profiel_eerst'` uitsluitend
voor een vergelijking worden opgeroepen:

- Een **actief zoekprofiel** met concrete zoekcriteria blijft een contactroute
  opleveren, ook voor makelaars en bemiddelaars zonder aantoonbaar mandaat.
- Algemene aankoopcriteria kunnen een contactroute opleveren bij een
  **expliciet gekozen** passend partijprofiel, waaronder Fonds, Family office,
  ontwikkelende belegger en makelaar/bemiddelaar.
- Een historisch hoofdtype of oude commerciële rol wordt niet als
  classificatie of mandaatbewijs gebruikt in de simulatie.
- Een eigenaar zonder expliciete aankoopwens wordt niet automatisch koper.
- De simulatieroute maakt nooit automatisch een economische koper aan.
  Geverifieerde opdrachtgevers met bestaande relaties blijven afzonderlijk
  herkenbaar; mandaatstatus wordt geen filter voor directe contactroutes.

Het pure `vergelijkMatchBeleid` berekent op reeds geladen objecten en relaties
de aantallen kandidaat-objectcombinaties in beide modellen, verschillen
(verloren/nieuwe koppelingen), objecten met verschil en verwijzingen naar
economische kopers die zouden wijzigen.

**Belangrijke beperking:** de vergelijking is een *voorzichtige simulatie*,
geen goedgekeurde nieuwe bedrijfslogica. Ze houdt niet automatisch rekening
met bestaande pipelinekoppelingen, contacthistorie, exclusiviteit of reeds
gedane aanbiedingen. De aantallen zijn dus niet gelijk aan werkelijk
verstuurde koopkansen en mogen niet worden gezien als voorspelde deals.

Er gaan geen namen, resultaten of rapportages naar een externe dienst.
De berekening draait in het ingelogde CRM uitsluitend op reeds geladen data
als de gebruiker op 'Simulatie bekijken' klikt. Er is geen DB-write.

## 3. Gates vóór uitfasering oude velden

1. Voorstellen controleren met relatiebron, waar nodig contacthistorie en
   expliciete gebruikersbeslissing. `NULL` blijft onbekend.
2. Vastleggen welke **ene bron** geldt voor contactroute, daadwerkelijke
   koperidentiteit, object-/zoekcriteria, partijtype en investeringsaanpak.
3. Nieuw beleid testmatig vergelijken met *alle* actuele matches,
   zoekprofielen en eerdere CRM-operaties. Extra aandacht voor
   ontwikkelaars, makelaars, bemiddelaars en relaties zonder actieve
   mandaatregistratie.
4. Onafhankelijke acceptatie van verschillen; export-/backup- en
   rollbackplan voor eventueel terugvullen of schemawijzigingen.
5. Pas dan oude UI-opties, matchingafhankelijkheden en als laatste de
   onderliggende kolommen daadwerkelijk verwijderen.

## 4. Niet uitgevoerd

A15 heeft géén classificaties van de 135 bestaande relaties aangepast,
géén 'developer'-rol uit `commercial_roles` verwijderd, en géén enkele
productiematch gewijzigd. A14 moet afzonderlijk worden geaccepteerd en
de noodzakelijke nieuwe Partijprofiel CHECK in Supabase worden toegepast
voordat de aanvullende profielwaarden kunnen worden opgeslagen.

## A15.2 — bescherming van bestaande pipeline (read-only)

Een nieuwe productie-SELECT telde 67 lopende kandidaatpipelinekoppelingen bij
39 actieve relaties. Van deze relaties hebben 38 nog geen expliciet
Partijprofiel. Van de 67 koppelingen vallen er 32 buiten de simulatie,
omdat hun object niet de status `beschikbaar` heeft. Deze aantallen zijn
een nulmeting, geen classificatie- of migratiebesluit.

De optionele matchingvergelijking telt nu lopende pipelinekoppelingen
**afzonderlijk** van gegenereerde kandidaatvoorstellen. Zij toont het
aantal relaties zonder Partijprofiel binnen lopende pipeline, het aantal
koppelingen met een matchingverschil en het aantal koppelingen buiten de
vergelijking. Koppelingen in die laatste categorie mogen **niet** als
gecontroleerd worden aangemerkt. Bestaande actieve pipelineparen krijgen
een markering als er een verschil wordt getoond.

Historie `afgevallen` en `afgerond` is geen lopende pipeline. Alle
bestaande pipeline-, zoekprofiel- en contactgegevens blijven onveranderd.
Er is niets gemigreerd of naar productie uitgerold.

## A15.3 — gecombineerde hoedanigheden en koperidentiteit (acceptatiepoort)

Inhoudelijke review maakt duidelijk dat **één relatie gelijktijdig meerdere
hoedanigheden** kan hebben: bijvoorbeeld ontwikkelaar die ook bemiddelt,
of ontwikkelende belegger die bij specifieke objecten directe kandidaat-koper
is. Dit zijn geen twee concurrerende partijprofielen; de hoedanigheid bij
een transactie heeft een andere betekenis dan de algemene typering.

- Eén leidend algemeen `partijprofiel` blijft mogelijk, maar **secundaire
  activiteiten moeten afzonderlijk, vindbaar en bewerkbaar** worden
  vastgelegd voordat de historische rolvelden kunnen worden verwijderd.
  Er mogen geen twee bewerkbare kopieën van hetzelfde gegeven ontstaan.
- `ontwikkelende_belegger` of `ontwikkelaar` bewijst op zichzelf geen
  formele koperrol; een expliciete koperrol / bestaande concrete
  kandidaatkoppeling mag daarentegen niet worden weggepoetst.
- Een partij die ook bemiddelt mag blijven deelnemen aan matching en
  hoeft geen aantoonbaar mandaat te hebben om proposities te ontvangen.
  Bemiddeling is niet hetzelfde als de economische koper zijn.
- De A15-proef toont nu via regressietests twee risico's in de
  **nog niet goedgekeurde** nieuwe matchvariant: verlies van de bestaande
  bevestigingsindicatie bij gecombineerde ontwikkelaar/bemiddelaar en
  verlies van een expliciet bestaande koperverwijzing bij een
  ontwikkelende belegger. Beide zijn **open releaseblokkades**.
- Historische dossier- en pipelinekoppelingen blijven leidend als
  bewijsspoor. Het aanvullen of wijzigen van echte profielen en rollen
  gebeurt pas via een gecontroleerde relatie-voor-relatie review.
  
Geen individueel identificeerbare relaties in de repositorydocumentatie
opgenomen; geen SQL-wijzigingen, massale herclassificatie, merge of deploy.

## A15.4 — één partijprofiel, afzonderlijke transactierollen (ontwikkelbranch)

De relatiepagina heeft een zelfstandige inline-sectie **Activiteiten en
transactierollen**. Deze sectie gebruikt het bestaande
`relaties.commercial_roles` als **enige opslagbron voor de activiteit**,
dus geen extra kolom, kopie of migratie. Uit de historische classificatie
wordt niet automatisch een activiteit afgeleid.

- **Partijprofiel**: wat voor partij het is (bijvoorbeeld
  `ontwikkelaar` of `ontwikkelende_belegger`), één hoofdkeuze.
- **Activiteiten**: wat de partij in het netwerk kan doen (zelf kopen,
  verkopen, voor derden bemiddelen, adviseren, beheren of financieren).
  Meerdere zijn mogelijk; `bemiddelaar` is hier een activiteit en
  wordt niet als tweede *partijclassificatie* gevraagd.
- **Bestaand zoeken en transacties**: concrete zoekwensen blijven in
  Zoekprofielen, bestaande kandidaatkoppelingen in de pipeline, de
  uiteindelijke identiteit van een economische koper bij de transactie.
  Een algemene koperactiviteit bewijst geen bod, mandaat of eigendom.

Historische waarden zoals `makelaar` en `ontwikkelaar` in
`commercial_roles` blijven read-only zichtbaar en worden niet in de
wijzigbare activiteitenlijst aangeboden. Bij opslaan worden uitsluitend
wijzigbare rollen aangepast; alle overige historische waarden blijven
ongewijzigd. Ook een wijziging van partijprofiel of strategie schrijft
geen rollen mee. Bij een wijziging van dezelfde rollen elders krijgt de
gebruiker een conflictmelding.

Nieuwe gerichte synthetische tests dekken een partij die tegelijk
ontwikkelt en bemiddelt, een ontwikkelende belegger die voor eigen rekening
kan kopen, behoud van historische waarden, lege patches en conflicten.
Het betreft nog steeds een **draft**: geen bestaande relaties zijn
geherclassificeerd, geen nieuwe koperidentiteiten zijn definitief
vastgesteld en het matchbeleid is niet omgezet.

**Open overgangsvoorwaarde:** de oude A15-`profiel_eerst`-simulatie
kan nog verschillen tonen in koperidentiteit en bevestigingsstatus.
Dat is geen automatische correctie; voor release moeten die verschillen
per bestaand kandidaatdossier beoordeeld en geaccepteerd zijn. De nieuwe
inline-sectie maakt het vastleggen van rollen mogelijk maar rechtvaardigt
geen onomkeerbare opschoning.

## A15.5 — behoud bestaande kandidaatposities, ook buiten gegenereerde matching

**Nieuwe acceptatiepoort op de draft branch:** een bestaande kandidaatpositie
(`object_pipeline`) is een zelfstandige procesregistratie, en **niet**
afhankelijk van het bestaan van een nieuw berekend matchvoorstel. Daarom
vergelijkt de optionele A15-simulatie nu per lopende pipelinepositie:

1. Betreft het een momenteel aanbiedbaar object? Zo niet, toon de positie als
   **buiten simulatie**, bijvoorbeeld bij `on_hold`. De procesregistratie
   moet volledig behouden blijven.
2. Komt de relatie noch in het oude, noch in het nieuwe matchresultaat voor?
   Toon **geen match in beide modellen** als controlepunt. De oude kandidaat
   wordt **niet** verwijderd en wordt niet automatisch als afgevallen gezet.
3. Verdwijnt de oude route door de nieuwe matching? Markeer **valt weg**.
4. Verschilt de berekende koperverwijzing? Markeer **koperverwijzing**; pas de
   feitelijke koperidentiteit niet automatisch aan.
5. Verandert alleen de matchroute/kwalificatie/bevestigingsindicatie? Toon
   **andere wijziging**.
6. Zijn de routes gelijk maar ontbreekt een bevestigd partijprofiel? Blijf
   **profiel ontbreekt** tonen totdat de relatie inhoudelijk is beoordeeld.

Deze controle heeft een eigen filterbaar overzicht met links naar het
bestaande object en de bestaande relatie. Particuliere contacten zonder
bedrijfsnaam kunnen onder hun reeds geregistreerde primaire contactnaam
zichtbaar blijven. De pipelinefase blijft leesbaar.

Dit onderdeel is opzettelijk **read-only**, zonder aparte SQL-aanvraag bij
openen; het werkt op reeds geladen CRM-data. Het maakt **geen** nieuwe
kopers, kandidaten, biedingen, zoekprofielen of transacties aan en wist
niets. De bestaande matchengine blijft standaard actief.

**Vóór release of fysieke opschoning:** alle als risicovol aangemerkte
pipelineposities per object en relatie inhoudelijk controleren. Zelfs
de groep zonder zichtbaar berekend verschil is géén bewijs voor een
juridisch vastgestelde koper. Dossierhistorie en concrete
contact-/biedingsinformatie blijven de bron voor transacties.

## A15.6 — vrijgavecontrole en actuele database-nulmeting (1 november 2026)

Aanleiding: de laatst gecontroleerde A15.5 workflow had een falende
UI-assertie omdat `Buiten simulatie` twee keer in het scherm voorkwam.
De TypeScript-controle en productiebuild slaagden wel. De schermassertie is
aangepast zodat zij expliciet beide labels verwacht.

Een nieuwe **uitsluitend read-only SQL-select** op de huidige database
leverde de volgende aantallen op (momentopname, geen client-side matching
of acceptatie van classificaties):

| Onderdeel | Aantal |
|---|---:|
| Lopende pipelineposities | 67 |
| Unieke relaties met lopende pipeline | 39 |
| Pipelineposities zonder bevestigd partijprofiel | 64 |
| Unieke relaties in lopende pipeline zonder partijprofiel | 38 |
| Posities met een actief zoekprofiel bij de relatie | 16 |
| Posities zonder actief zoekprofiel bij de relatie | 51 |
| Posities zonder gestructureerd type, regio, budget én zonder actief zoekprofiel | 12 |
| Posities waarvan object niet beschikbaar is voor nieuwe matching | 32 |
| Posities met historische expliciete koperrol | 3 |
| Pipelineposities bij gearchiveerde relaties | 0 |

**Definitie:** `zonder gestructureerd type, regio, budget` laat vrije
aankoopteksten, contactmomenten, acquisitiebesprekingen, biedingen en
bestaande pipelinehistorie buiten beschouwing. Deze 12 posities zijn
daarom **geen** bewijs van ontbrekende koopinteresse of ongeldige relaties.

De nieuwe `beoordeelA15Vrijgave` is een afzonderlijke, zuiver functionele,
read-only releasecontrole. Zij laat de volgende voorwaarden in het CRM
zien: niet-geclassificeerde relaties, lopende pipelineposities met
aandachtspunten, posities zonder berekende match, wegvallende routes,
gewijzigde koperverwijzingen, posities buiten de simulatie en andere
wegvallende gegenereerde kandidaatvoorstellen.

Daarbij blijven **drie handmatige vrijgavepoorten altijd open**:
1. Geschikte versie-/schemacontrole en een reversibel migratieplan;
2. Backup, herstelproef, vergelijking van aantallen en rollback-plan;
3. Expliciete inhoudelijke én technische vrijgave na review.

Er is **geen** knop die op basis van een nulstand automatisch een
destructieve migratie of productie-release triggert. De controlerapportage
legt **geen** goedkeuring in localStorage, database of repository vast.
Een gesloten databewaking betekent niet dat een handmatig dossier
als beoordeeld mag worden beschouwd. Deze poorten moeten vóór de
daadwerkelijke verwijdering van oude velden afzonderlijk kunnen worden
gecontroleerd en geaccordeerd.

**Open blokkade:** A14-schema-uitbreiding is nog niet op productie
toegepast; alle live relatievelden, bestaande kandidaatposities en
standaard matching blijven ongewijzigd. PR #563 blijft draft.
