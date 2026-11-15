# CRM-test-preview zonder productie-login (15 november 2026)

De vaste host \`bitovastgoed-git-crm-test-bitovastgoed.vercel.app\` laadt vanuit \`src/main.tsx\` uitsluitend \`src/demo/CrmSandboxApp.tsx\` en daaronder de bestaande, pure adres- en samenstellingsproeven.

**Geen productie-auth:** de demo importeert geen \`App.tsx\`, \`AuthProvider\`, \`CrmProtectedApp\`, \`DataStoreProvider\`, Supabase-client of productierepositories. In de demo hoeft de gebruiker zich daarom niet aan te melden.

**Geen productiegegevens:** fictieve objecten en één fictieve belegger zijn in de client gedefinieerd. Matchingbewerkingen zijn uitsluitend client-side. De fictieve instellingen kunnen in \`localStorage\` worden opgeslagen en met 'Herstellen' worden gereset. Het browserwerk is géén volledige CRM-integratietest.

**Geen brede login-bypass:** alle overige hostnames, waaronder productie en andere previewdeployments, laden ongewijzigd \`App.tsx\` met de bestaande beveiligde route. De hostmatch is een exacte vergelijking.

**Waarom niet de normale CRM zonder login?** De previewprojectvariabelen verwijzen nog naar de productiedatabase. Het verwijderen van login uit de normale CRM zou onbedoelde toegang of wijzigingen mogelijk maken. Het vaste testadres laadt daarom een daadwerkelijk gescheiden demo, niet dezelfde live CRM.

**Opmerking:** het Vercel-project blijft voor andere previews gekoppeld aan de productieomgeving. UI-testen met echte CRUD-acties is buiten deze demonstratie niet toegestaan tot er een aparte testdatabase is. GitHub Actions gebruiken tijdelijke PostgreSQL-containers die na de testrun worden verwijderd.

**Routes op de vaste host:** \`/relaties\`, \`/objecten\`, \`/objecten/adresproef\` en \`/objecten/samenstellingproef\`. Andere routes worden naar het fictieve matchingoverzicht geleid.


## Doorontwikkeling: één fictieve set objectgegevens en meerdere beleggers (15 november 2026)

De objectonderdelen op `/objecten/samenstellingproef` zijn de **enige** invoer voor
gebouwfunctie, m² en meetbasis in de geïsoleerde demo. `/relaties` leest diezelfde
lokale state en vergelijkt deze met afzonderlijke fictieve profielen voor
bedrijfsruimte (70% VVO, hard) en residentieel vastgoed (80% GBO, hard).
Aanpassingen worden direct voor beide profielen herberekend.

De fictieve onafhankelijke totaaloppervlaktes staan vast per scenario en worden
NIET uit de huidige, door de gebruiker aangepaste onderdeelregels afgeleid.
Een verschil in totale m², onbekende bronafbakening, of onvergelijkbare meetbasis
leidt automatisch tot `Controle nodig`. Geen extra bronvinkjes of verzonnen
verificatie. Bronafbakening is uitsluitend bewijs binnen de fictieve oefensituatie.

Instellingen worden lokaal in `bito-crm-gescheiden-proef-v2` opgeslagen en
hersteld. De eerdere browserinstellingen worden eenmalig ingelezen als er nog
geen v2-gegevens bestaan. Geen Supabase-client, echte relatie, object, backend
of productiedatabase is betrokken. De afzonderlijke adresproef blijft een eigen
client-only formulier zonder relatie met de matchberekening.
