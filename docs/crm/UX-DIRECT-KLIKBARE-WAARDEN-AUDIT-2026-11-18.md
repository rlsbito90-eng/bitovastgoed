# Bito CRM — UX-audit direct bewerken vanuit dossier
**Peildatum:** 18 november 2026  
**Onderzoek:** broncode-inventarisatie van de kernmodules (Objecten, Relaties, Taken, Deals, Huurders, Contactpersonen, Biedingen, Zoekprofielen, selectievelden) en circa 36 representatieve pagina's en componenten. Dit is een code-audit, geen volledige handmatige ingelogde browsertest.

## Centrale bevinding
De CRM is inmiddels grotendeels inline *bewerkbaar*, maar vaak niet inline *bedienbaar*: kleine aparte potloodjes staan rechts of een volledige sectie wisselt pas na 'Wijzig hier' naar een formulier. Deze inconsistentie maakt veelgebruikte wijzigingen onnodig traag en creëert visuele ruis. Uitgangspunt: klik op bestaande informatie om haar te wijzigen, niet op een verborgen knop naast de informatie.

## Ontwerpcontract (CRM-breed)
1. **Leesmodus = interactief:** een gewone veldwaarde is zelf een groot klikvlak; hover/focus zijn subtiel, geen zware achtergrondkaarten of permanente potloodknoppen. Aanraakvlak minimaal 40–44 px.
2. **Direct bij waarden:** éénregelige tekst, bedragen, percentages en oppervlakten krijgen invoer op de plek van de waarde. Enter of blur slaat op; Escape annuleert. Bij lange tekst: Ctrl/Cmd+Enter om op te slaan; Enter is nieuwe regel.
3. **Direct bij keuzes:** status, profiel, rol, type en andere enumeraties zijn klikbare waarden die naar select, popover, combobox of compacte lijst wisselen. Geen dubbele bediening of redundante 'Wijzig hier'.
4. **Entiteitskoppelingen:** eigenaar, koper, makelaar, contactpersoon, deal en object wijzigen via klik op naam of lege waarde; zoekbare picker selecteert een bestaande entiteit. Ontkoppelen blijft een afzonderlijke expliciete actie.
5. **Complexe groepen:** adres, huurcontract, contactpersoon en juridische gegevens openen op klik van hun samenvatting een lokaal bewerkpaneel of drawer, niet een alomvattend object-/relatieformulier. Gerelateerde velden samen opslaan; guard voor conflicten.
6. **Risicovolle mutaties:** archiveren, definitief biedingsbesluit, persoonsgegevens verwijderen, huurcontract verwijderen, transactiefase definitief afsluiten, handmatige vervanging van gevalideerde BAG-data of potentieel dataverlies vereisen een expliciete workflow met bevestiging/historie.
7. **Berekende velden:** niet klikkend 'wijzigbaar' maken; toon bron en link naar brongegevens, geen schijnbare handmatige invoer.
8. **Toegankelijkheid:** native button/select, zichtbaar focuskader, Enter/Spatie, aria-label, geen uitsluitend op hover zichtbare acties; mobiel ≥44 px waar mogelijk.
9. **Data:** geen onbedoelde wissen met leeg input; wijzigingspatches uitsluitend voor het bewerkte veld; undo, opslaan-status, fout- en concurrencycontrole. Bronwaarden, eenheid en oude legacyvelden intact laten.
10. **Dichtheid:** één subtiele edit-indicatie per waarde op hover/focus, rustige leesrijen en ingeklapte secundaire details. Niet simpelweg alle potloodjes vervangen door permanente knoppen.

## Inventarisatie en prioriteit
| Deel | Locatie | Huidige frictie | Doelontwerp | Risico/prioriteit |
|---|---|---|---|---|
| Object → kerngegevens | `ObjectKerngegevensInline` | 'Wijzigen' rechts bij verkoopmotivatie | Klik op tekst of lege waarde; autosave | **P0** |
| Object → commercieel | `ObjectCommercieelInline` | Aparte editknop naast vraagprijs/jaarhuur/prijsindicatie | Klik op bedrag/tekst; expliciet wissen blijft apart | **P0** |
| Object → fysiek | `ObjectFysiekInline` | Zeer klein potlood naast iedere m² | Klik op m²; meetsoorten apart en validatie behouden | **P0** |
| Object → technische staat | `ObjectOnderhoudInline` | Potlood naast drie notities | Klik op eigen waarde; beheer niveau via select | **P0** |
| Relatie/object/deal kiezen | `EntityPicker` | Huidige naam is niet klikbaar, wel 'Wijzigen' aan rechterkant | Complete geselecteerde waarde opent zoeken | **P0** |
| Relaties → standaard kaartvelden | `InlineRelatieSectie` | 'Wijzig hier' schakelt hele kaart naar formulier | **Per veld** bewerken; complexe sets apart | **P0 — vervolg** |
| Relaties → partijprofiel | `InlineRelatieClassificatie` | 'Wijzig classificatie' voor 1 keuze | Klik op profiel/strategie; onderscheid extra activiteiten | **P1** |
| Relaties → vastgoedvoorkeuren | `InlineVastgoedVoorkeuren` | 'Wijzig hier' vereist, ook voor 1 subtype | Klik op classificatie, open compacte zoekbare keuze | **P1** |
| Relaties → rendement | `RendementscriteriaPanel` | Klein potlood voor meerledige rendementeis | Klik criteriumregel; bewerk samenhangende definitie | **P1**, validatie BAR/NAR/marge |
| Relaties → contactpersonen | `ContactpersonenPanel` | Potlood rechts van kaart | Klik op naam of rij; e-mail/tel/LinkedIn blijven eigen linkacties | **P1**, privacy |
| Object → huurders | `HuurdersPanel` | Potlood rechts van huurderkaart | Klik huurdernaam/rij voor compact paneel | **P1**, contract/huur |
| Object → classificatie | `ObjectClassificatieInline` | Eén 'Wijzigen' boven hele sectie | Klik op samenvatting, open lokale picker | **P1**, subtypes/conflictbevestiging |
| Object → locatie | `ObjectLocatieInline` | 'Wijzigen' boven adreskaart | Klik adresregel, bewerk adres als groep | **P1**, BAG-geo reset |
| Zoekprofielen | `ZoekprofielenPage` | Rij al klikbaar; extra bewerkicoon secundair | Consistent met rijinteractie, geen dubbele CTA | **P2** |
| Deals | `DealDetailPage` | Header 'Bewerken' voor veel details | Titel/fee/procesgegevens vanuit veld; complex via paneel | **P2**, bewaar transactielogica |
| Taken | `TaakDetailPage`, `TaskRow` | Taakrij is al klikbaar; detail heeft 'Bewerken' | Deadline/status/naam direct, uitgebreide metadata op aanvraag | **P2** |
| Acquisitietargets | `AcquisitieTargetDetailPage` | Alleen grote bewerkdialoog | Direct dossierwaarden en keuzes | **P2** |
| Biedingen | `BiedingenSection` | Expliciete bewerking/audit | **Niet** blind inline; behoud tegenbod/afwijzing/historie | Beveiligde uitzondering |
| Documenten | `DocumentenPanel` | Status-/documentacties afzonderlijk | Documentstatus direct, verwijderen bevestigen | **P2**, audit |
| Aanmaakformulieren | `QuickCreateRelationDialog`, `RelatieFormDialog`, `ObjectQuickCreateDialog` | Formulieren zijn hier functioneel | Kort en consistent; na eerste registratie naar dossier | Behouden |

## Afbakening eerste implementatie (P0-slice)
- Eén herbruikbare `EditableValueButton`: een klik op de waarde opent het al bestaande inline editveld; focusindicator en native toetsenbordbediening.
- Toegepast op verkoopmotivatie, vraagprijs, objectjaarhuur, prijsindicatie, VVO/BVO/GBO/perceel/totaal en onderhoudsnotities.
- `EntityPicker`: geselecteerde naam of lege keuze is zelf klikbaar; apart kruisje uitsluitend voor bewust ontkoppelen.
- De bestaande autosave-, validatie-, expliciete wis- en undo-logica blijft ongewijzigd.
- Geen nieuwe backend- of databasemigratie.
- Gedekte regresstests voor normale waarden, selectie, PII-beveiliging en financiële dataguards.

## Voorstel vervolg in geordende kleine releases
**Release B: Relaties (hoogste frictie).** `InlineRelatieSectie` migreren van sectiebrede editor naar individuele editrows, met inputtypespecifieke validatie, patch per veld en conflictcheck. Daarna `InlineRelatieClassificatie` en `InlineVastgoedVoorkeuren` op dezelfde interactiestandaard. Dit is meer dan cosmetisch: vermijd dubbele save/undo en houd gegevens veilig.

**Release C: Koppelingen en personen.** `ContactpersonenPanel`, `HuurdersPanel`, `ObjectLocatieInline`, `ObjectClassificatieInline`. Klik op samenvatting opent lokaal bewerkpaneel; contactlinks blijven actief en contracten/geo blijven atomair.

**Release D: Overige kernmodules.** Taakdetails, deals, zoekprofielen, acquisitie en documentstatus. Risicovolle status- en financiële mutaties via expliciete workflows, niet via automatisch opslaan.

**Release E: Integrale visuele QA.** Desktop/macOS app, mobiele breedtes, toetsenbord en screenreader, focus/scroll herstel, licht/donker, regressietests op bestaande dossiers; eerst testen met representatieve echte maar niet-herkenbare datasets.

## Acceptatiecriteria
- Voor de 10 meest voorkomende reguliere wijzigingen: maximaal één klik op de getoonde waarde om te bewerken; opslaan gebeurt automatisch of met Enter.
- Geen verplicht minuscule editicoon als enige ingang.
- Geen extra `Bewerken`-formulier na eerste invoer voor eenvoudige wijzigingen.
- Geen achteruitgang in matchingsregels, financiële veldbeveiliging, BAG-bron, partijprofiel, historische records of biedboek.
- Geen verborgen veranderingen bij navigeren, annuleren of onbedoeld leegmaken.
