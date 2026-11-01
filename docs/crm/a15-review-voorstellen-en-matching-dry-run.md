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
