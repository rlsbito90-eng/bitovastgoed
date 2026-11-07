# Fase 1 — Relaties als primair investeringsprofiel

Status: code ter review op branch `feat/relaties-centraal-investeringsprofiel`.
Supabase: additieve migratie `relaties_centraal_investeringsprofiel_fase1` uitgevoerd op project `vyjocdlwfxrblusfngfq` (7 november 2026). Bestaande relatiegegevens zijn niet gemigreerd of overschreven.

## Productbesluit

- **Relaties is de primaire bron van een beleggersprofiel.** Algemene aankoopcriteria staan daar, inclusief budget, vastgoedtypen, strategieën en verdere websiteformulier-criteria.
- **Aanvullende zoekprofielen zijn optioneel.** Gebruik deze uitsluitend als eenzelfde partij apart te beheren zoekrichtingen heeft, bijvoorbeeld woningen < € 1 mln en kantoren < € 3 mln.
- Gegevens uit nieuwe website-inzendingen worden in latere fase beoordeeld tegen bestaande relaties en **niet stilzwijgend overschreven**. Dit is fase 3 en niet in deze wijziging opgenomen.
- Oude `zoekprofielen` en kandidaat-/dealhistorie blijven ongewijzigd.

## Database — additieve kolommen in public.relaties

| Kolom | Type | Websiteveld |
|---|---|---|
| zoekgebied_toelichting | text | Zoekgebied, vrije tekst en straal |
| gewenste_objectomvang | text | Gewenste objectomvang |
| gewenste_situatie | text[] | Gewenste situatie, meerdere keuzes |
| aankooptermijn | text | Gewenste aankooptermijn |
| financieringsstructuur | text | Financieringsstructuur |
| financieringsstatus | text | Status financiering |
| besluitvorming | text | Besluitvorming |
| uitsluitingen | text | Wat past nadrukkelijk niet? |
| overige_toelichting | text | Overige toelichting |
| strategie_toelichting | text | Extra strategie die nog niet in de taxonomie past |

Bestaande velden: `partijprofiel`, `vastgoed_strategieen`, `property_type_ids`, `property_subtype_ids`, `deal_type_ids`, `regio`, `budget_min`, `budget_max`, `rendementseis`, `aankoopcriteria` en `kapitaalsituatie`. Websitekeuze **Vastgoedportefeuilles** valt in de bestaande property-taxonomie onder `Vastgoedportefeuille` (`slug: portefeuille`); dit krijgt bewust geen tweede checkbox.

De exacte website-labels dienen bij fase 3 expliciet en controleerbaar op de bestaande vastgoedtaxonomie te worden gemapt; `Vastgoedportefeuilles` is een bestaand vastgoedtype in de huidige CRM-taxonomie. De originele inzending moet als brondocument worden bewaard; niet alle vrije tekst of meervoudige situaties kunnen veilig als harde matchfilter worden gebruikt.

## Matching

- De objectkandidaat-adapter `maakKandidaatVoorstellen` kon algemene criteria uit Relaties al gebruiken.
- `getMatchesForRelatieFromData` op de relatiekaart doet dat nu eveneens via een **virtueel, niet-opgeslagen basisprofiel** naast bestaande actieve, afzonderlijke profielen.
- Geen basisprofiel zonder ingevulde vastgoedtypen. Geen automatische vermenging van ontbrekende broninformatie met expliciete `nee`.
- Objecten buiten het budget of niet beschikbaar worden niet als nieuwe match getoond. Eén object verschijnt maximaal één keer.
- **Nog handmatig beoordelen:** vrije zoekradius, meerdere verhuursituaties, gewenste aankooptermijn, financieringsstatus, portefeuillevoorkeur en vrije strategie-/uitsluitingstekst. Deze velden worden bewaard, maar zijn geen automatische harde filters. De interface mag geen volledige geverifieerde match suggereren.

## Voor productiepublicatie

1. Controleer desktop en mobiel: relatiekaart, nieuw relatieformulier, bewerken en opslaan.
2. Test een relatie **zonder** apart zoekprofiel: match uit Relaties, en budget/soort object correct.
3. Test een relatie **met** extra profiel: geen dubbele objecten of verdwenen bestaande records.
4. Test een kandidaat met `commercial_roles` en `partijprofiel` op historisch afwijkende waarden.
5. Voer geen import van de 15 profielen uit voordat deduplicatie en veldmapping zijn gecontroleerd.
6. Merge/deploy pas na geslaagde controles.
