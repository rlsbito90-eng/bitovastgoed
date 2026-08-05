# PLAN — gedeelde acquisitieflow voor Vastgoedkansen

## Aanleiding

De detailpagina van Vastgoedkansen bevat nu dubbele navigatie voor Kaart, Kadaster & eigenaar en Brieven & opvolging. De inhoud achter Kadaster & eigenaar en Brieven & opvolging bestaat grotendeels uit losse handmatige velden, terwijl Off-Market Radar al volwassen werkstromen bevat voor eigenaarsonderzoek, relatiekoppeling, taken, contactmomenten, briefvoorbereiding, PDF, verzending, respons en opvolging.

## Doel

Vastgoedkansen moet dezelfde bewezen acquisitiewerkstromen kunnen gebruiken als Off-Market Radar, zonder twee afzonderlijke systemen voor eigenaar-, Kadaster-, brief- en opvolgdata te onderhouden.

## Vastgestelde huidige situatie

### Vastgoedkansen

- bovenste actiebalk dupliceert tabnavigatie;
- Kadaster & eigenaar is een handmatig formulier;
- Brieven & opvolging is een handmatig formulier;
- geen conceptbeheer, briefgeneratie, PDF, geadresseerdengroepen, responsdialoog of taaktemplates;
- geen volwaardige relatie-aanmaak of relatiekoppeling vanuit eigenaarsonderzoek.

### Off-Market Radar

- `SignaalEigenaarsonderzoekSectie` bevat de volledige eigenaarflow;
- `SignaalBrievenSectie` bevat de volledige brieven- en opvolgflow;
- beide componenten zijn technisch nog gekoppeld aan `OffMarketSignaal` en `signaal.id`;
- hooks en opslagcontracten verwijzen deels rechtstreeks naar `off_market_signalen`.

## Architectuurbesluit

De bestaande Off-Market-componenten worden niet gekopieerd. We introduceren een gedeelde acquisitiedossiercontext en bouwen adapters per brontype.

```ts
interface AcquisitieDossierContext {
  bronType: 'off_market_signaal' | 'vastgoedkans';
  bronId: string;
  objectId: string | null;
  adres: string;
  plaats: string | null;
  eigenaarRelatieId: string | null;
}
```

Gedeelde UI en workflows werken uitsluitend tegen deze context en capability-adapters. Bronspecifieke hooks blijven achter adapters verborgen.

## Capabilities

De gedeelde laag moet minimaal ondersteunen:

1. eigenaargegevens lezen en expliciet opslaan;
2. eigenaarstatus wijzigen;
3. Kadastercheck handmatig registreren;
4. relatie aanmaken, koppelen, wisselen en ontkoppelen;
5. taak aanmaken vanuit templates;
6. contactmoment registreren;
7. brief voorbereiden en bestaand concept heropenen;
8. PDF genereren en tekst kopiëren;
9. brief als verstuurd markeren;
10. respons registreren;
11. opvolgtaak en tijdlijn tonen;
12. meerdere geadresseerden ondersteunen.

## Gefaseerde BUILD

### BUILD 1 — UX en gedeeld contract

- verwijder dubbele tabknoppen uit de bovenste actiebalk;
- behoud Kaart als externe contextactie;
- voeg `AcquisitieDossierContext` en capability-contracten toe;
- voeg adapters toe voor Off-Market en Vastgoedkansen zonder gedrag te wijzigen;
- voeg contracttests toe.

### BUILD 2 — Kadaster & eigenaar

- maak eigenaarsonderzoek component contextgestuurd;
- laat Off-Market via de bestaande adapter werken;
- sluit Vastgoedkansen aan op dezelfde flow;
- behoud handmatige Kadastergrens: geen automatische bestelling;
- koppel relaties, taken en contactmomenten CRM-breed.

### BUILD 3 — Brieven & opvolging

- maak briefsectie contextgestuurd;
- ondersteun brieven per geadresseerde voor beide brontypen;
- hergebruik concept-, PDF-, verzending-, respons- en opvolgflows;
- migreer samenvattende Vastgoedkansen-velden naar afgeleide status waar veilig;
- verwijder pas daarna overbodige handmatige velden.

### BUILD 4 — Dossierconsolidatie

- taken en tijdlijn samenbrengen;
- documenten en bronkoppelingen toevoegen;
- object-ID als primaire CRM-brede koppeling gebruiken zodra operationeel beschikbaar;
- regressietests voor beide modules.

## Veiligheidsgrenzen

- geen automatische Kadasterbestelling;
- geen betaalde providercall;
- geen productiedata-migratie in BUILD 1;
- geen verwijdering van bestaande velden voordat backfill en compatibiliteit zijn bewezen;
- geen wijziging aan Auth, RLS of productieconfiguratie;
- bestaande Off-Market Radar mag functioneel niet achteruitgaan.

## Acceptatiecriteria BUILD 1

- de bovenste balk bevat geen dubbele knoppen voor tabs;
- Kaart blijft beschikbaar;
- beide brontypen kunnen naar één valide dossiercontext worden gemapt;
- capability-contracten bevatten geen Supabase- of tabelkennis;
- tests bewijzen stabiele contextnormalisatie en ontbrekende optionele waarden;
- geen database- of migratiewijzigingen.
