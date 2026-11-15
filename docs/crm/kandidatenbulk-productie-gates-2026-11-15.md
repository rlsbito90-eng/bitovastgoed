# Kandidatenbulk — veiligheidspoorten naar productie

**Status 15 november 2026:** uitsluitend de afgescheiden CRM-testbranch. Niet vrijgeven naar productie op basis van synthetische tests alleen.

## Geteste onderdelen

- Geïsoleerde PostgreSQL 17, inclusief de originele pipelinefundament-migratie uit de CRM-repository.
- De bestaande pipeline → taak-trigger, inclusief latere enumfix, plus de verliescode-trigger.
- De echte updated_at-trigger uit het productie-schema: deze schrijft NOW() en vervangt een expliciete timestamp.
- Atomische bulkacties, idempotentie, audit, herstel, rollen, objectfase en geaggregeerde interne uitsluitingscategorieën.
- Geen productiegegevens gebruikt of aangepast.

## Nog openstaande gedragskeuzes

**Herstel en opvolgtaken.** Een open opvolgtaak wordt bij interne uitsluiting geannuleerd. Bij herstel maakt de bestaande CRM-trigger een nieuwe actieve opvolgtaak; de oorspronkelijke taak-ID blijft geannuleerd in de historische registratie. Dat is technisch consistent maar nog niet expliciet de gewenste Undo-semantiek. Waarschuw in de UI en bepaal of de oorspronkelijke taak-ID moet kunnen worden hersteld.

**Interne redencategorieën.** De centrale verliescode-classifier zet de interne categorie locatie om naar other. Een apart auditrecord bewaart locatie wél. Voor actuele interne BULK-uitsluitingen is een beveiligde, RLS-respecterende rapportageview ontworpen die herstelde registraties uitsluit. Verwar dit niet met inkomende koperfeedback en niet met individuele afwijzingen.

**Databaseversie.** Gebruik uitsluitend het daadwerkelijk na triggers teruggegeven updated_at; de applicatie mag nooit veronderstellen dat de expliciet gevraagde tijdstempel opgeslagen is.

**Objectfase.** Een bulkfaseverandering mag het object uitsluitend vooruitzetten. Handmatige vergrendelingen en terminale objectfases winnen altijd. Ververs de kandidaten én objectfase na een geslaagde actie.

## Releasevoorwaarden

- [ ] Nieuw, expliciet goedgekeurd Supabase-testproject met kostencontrole; BAG-shadow niet hergebruiken.
- [ ] Test-Auth, fictieve gegevens en gescheiden publishable key; geen productie-sessies.
- [ ] End-to-end verificatie via echte Supabase Auth en Data API, niet alleen rechtstreeks PostgreSQL.
- [ ] Security review van SECURITY DEFINER RPC's, uitvoerrechten, objectautorisatie en RLS. Overweeg invoker-wrapper en interne niet-exposed functie.
- [ ] Vastgelegd besluit over herstel van opvolgtaken en hun identiteit.
- [ ] Live-CRM-interface aangesloten, inclusief objectrefresh, conflict-, onzeker- en undo-status.
- [ ] Geteste terugrolprocedure voordat een productie-migratie wordt uitgevoerd.

De bestaande, reeds op productie geplaatste kandidaten-sortering en het actiemenu vallen buiten deze blokkade. De bulk-RPC's, herstel en rapportageviews zijn alleen ontwerp en test; geen productie-migratie.
