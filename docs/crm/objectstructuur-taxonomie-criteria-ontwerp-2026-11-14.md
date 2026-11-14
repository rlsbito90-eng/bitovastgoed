# Bito CRM — Objectstructuur, taxonomie, criteria en matching

Status: ontwerpcontract, 14 november 2026. **Niet** automatisch migreren of productiedata aanpassen.

## 1. Waarom
Geuzenweg 22A/22B: twee adressen/appartementen kunnen één verkooppropositie zijn.
Amsterdam: drie verhuurde appartementen, één gezamenlijke verkoopprijs, drie locaties.
Gemengde bedrijfscomplexen: één object kan kantoor en bedrijfsruimte bevatten en één koper kan minimaal 70% bedrijfsruimte eisen.

## 2. Begrippen — strikt gescheiden

| Begrip | Betekenis | Cardinaliteit |
|---|---|---|
| Verkooppropositie | Eén pakket zoals aangeboden, incl. pakketprijs, voorwaarden en kandidaten/pipeline | 1 → N objecten |
| Vastgoedobject | Fysiek/juridisch te onderscheiden pand of appartementsrecht | 1 → N adressen/units |
| Adres | Adres-id met straat, huisnummer/toevoeging, postcode, plaats, BAG-verwijzing en verificatiestatus | 1 object ↔ meerdere adressen; nooit identiek aan 'unit' |
| Objectonderdeel | Verblijfs-/gebruiksfunctie of verhuureenheid met eigen meetbasis, oppervlakte, contract en eventueel prijs | N per object |
| Vastgoedtaxonomie | Centrale codes voor hoofdtype en sub-/gebruiksfunctie, gedeeld door Relaties/Objecten | Meervoudige functies mogelijk |
| Investeringsprofiel | Een afzonderlijk zoekmandaat van relatie; profiel kan meerdere harde eisen, voorkeuren en uitzonderingen hebben | N per relatie |
| Matchresultaat | Totaalscore 0–100 én eligibility status plus verklaarde redenen | Per propositie × profiel |

### Fysieke en commerciële scope
- Een adres maakt niet automatisch een zelfstandig object.
- Een object kan meer dan één BAG-adres en kadastraal perceel hebben.
- Vastgoedtype is **niet** identiek aan businesscase/dealtype (transformatie), commerciële aanbiedingsvorm (portefeuille) of exploitatiefase.
- Portfolio-scope voor criteria moet expliciet zijn: per unit, per gebouw of per portefeuille.

## 3. Geldregels

- Een propositie heeft één pakketvraagprijs indien alleen gezamenlijk aangeboden.
- Een individueel object krijgt alleen een vraagprijs als het **daadwerkelijk afzonderlijk aangeboden** wordt; geen stille pro rata allocatie.
- Maand-/jaarhuur op onderdeel/contractniveau kan bij volledige coverage tot object/propositie geaggregeerd worden; voorkom dubbeltellen met handmatige totaalhuur en incomplete huurdersregels. Toon de bron en volledigheidsstatus.
- BAR en factor op een gezamenlijke prijs gebruiken uitsluitend bijpassende jaarhuur op dezelfde scope. Geen automatische BAR als package-huur onbekend/onvolledig.
- Bij mixed-use mogen GBO en VVO niet ongemerkt in één €/m² ratio belanden. Voor fysiek kantoor/bedrijfsruimte kan VVO/VVO worden vergeleken mits scopes en bronnen gelijk.
- Totaaloppervlakte blijft een zelfstandig veld: geen optelsom van verschillende meetbegrippen.

## 4. Criteria: generiek getypeerde regels
Elke regel heeft minstens:
- `profile_id`, `criterion_key` (stabiele canonieke identifier), `operator`, `value`, `unit`, `strength` ('hard'/'preference'), `scope`, `explanation`, `source`, `verified_at`.
- Criteriumregister definieert unit, datatype, welke objectwaarde wordt gelezen, en of de vergelijking betrouwbaar geautomatiseerd kan worden.
- Niet ondersteund criterium: vrije tekst, géén onbewezen auto-score.

Acceptatiescenario bedrijfscomplex:
- Profiel: bedrijfsruimte minimaal 70% van de **vergelijkbaar gemeten** relevante VVO; alle overige relevante functies gezamenlijk maximaal 30%; `strength=hard`.
- Object 750 m² bedrijf / 250 m² kantoor -> pass.
- Object 650 m² bedrijf / 350 m² kantoor -> fail, ook bij matchscore 95.
- Object 750 m² bedrijf / 250 m² totaal onbekend -> `review_required`.
- Harde eis is geen score-penalty maar aparte eligibility gate; score 0–100 blijft zichtbaar met uitsluitreden.
- Onbekend is niet automatisch voldaan of afgewezen.

## 5. Data- en veiligheidscontract

- De bestaande `objecten.parent_object_id` en `is_portefeuille` blijven voor compatibiliteit leesbaar.
- Fase 1 zonder migratie: maak bestaande gekoppelde objecten zichtbaar inclusief kaartlinks; expliciet koppel-/ontkoppelacties en snel toevoegen.
- Later additieve tabellen (namen voorlopige ontwerptermen) `propositions`, `proposition_items`, `object_addresses`, `object_components`, `profile_criteria`. Datamodel en 1:1 omzetting eerst testen; dit document geeft geen toestemming om SQL uit te voeren.
- RLS: alleen geautoriseerde CRM-gebruikers, beperk mutaties op basis van bestaande rolrechten, volledige audit/rollback, geen publieke adresgegevens.
- Migratie: detecteer dubbele adressen, bestaande kindrecords, huur-/prijsvelden en kandidaatgeschiedenis, schrijf niets automatisch over.
- Migrate niet automatisch 'maatschappelijk'/'parkeren'/'alternatief' naar mixed-use of 'portefeuille' naar wonen.
- Performance: batchload/caching, geen nieuwe queries per object, no expensive continuous background tasks.

## 6. Aanbevolen fasering

1. **Portefeuille UX (in crm-test):** huidige parent-child records, directe koppelingen, adressen met Google Maps, individuele prijs niet optellen, snel toevoegen. Productie ongewijzigd.
2. **Adresseerbaarheid:** apart adresregister en BAG/kadasterkoppelingen; een adres hoeft geen extra object te zijn. Zoek, kaart en duplicaatcontrole op alle adressen.
3. **Onderdeelstructuur:** gebruiksfuncties/units; oppervlakten en huur per onderdeel, expliciete financiële scopes/coverage.
4. **Taxonomie harmoniseren:** Relaties en Objecten gebruiken dezelfde taxonomie-ID's; legacy-mapping slechts adviserend, niet automatisch beslissend.
5. **Flexibele criteriamotor:** getypeerde harde eisen/voorkeuren/tekstnotities, 0–100 score plus gate, geen false positive bij incomplete data.
6. **Migratie/uitrol:** geïsoleerde Supabase previewomgeving, met regressie- en RLS-tests, dan pas gecontroleerde productie-uitrol.

## 7. Acceptatiepunten
- Geuzenweg 22A/B: één verkooppropositie, beide adressen zichtbaar, ieder klikbaar in Maps, geen verplichte dubbele prijs.
- Amsterdam 3 appartementen: één vraagprijs op portefeuille, drie gelinkte dossiers; slechts één propositie in pipeline/aanbiedingsgeschiedenis.
- Gemengd bedrijfscomplex: 70/30 hard requirement, correct pass/fail/review en verklaarde scores.
- Bestaande objecten/relaties mogen na upgrade geen onbedoelde extra matches, dubbelgetelde prijzen of verdwenen adressen krijgen.
- Deelverkoop/los aanbieden blijft optioneel en krijgt pas een eigen propositie wanneer de gebruiker dit kiest.

## 8. Huidige beperkingen — eerlijk zichtbaar
- Fase 1 behoudt aparte CRM-objectrecords; nog geen apart adresregister of componententabel.
- Een hele portefeuille verschijnt in bestaande Objecten-lijst nog naast gekoppelde child-objecten.
- Er is nog geen gecombineerde overzichtskaart of batchimport van meerdere adressen.
- Bestaande kandidatenscores en pipeline worden nog niet geconsolideerd op propositieniveau.
- Geen nieuw SQL-schema of RLS-policy uitgevoerd; crm-test deelt de bestaande database.

### Eerste pure toetsfunctie
De functie `src/lib/matching/samenstellingscriterium.ts` toetst getypeerde min/max aandelen binnen een bevestigde volledige, niet-overlappende meetbasis. Deze is **nog niet** aangesloten op Relaties, Objecten of de live matching. Zo kunnen we de regels vooraf toetsen zonder productiegegevens te wijzigen.
