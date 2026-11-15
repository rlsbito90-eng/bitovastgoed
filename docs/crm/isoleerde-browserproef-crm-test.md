# CRM-test-preview zonder productie-login (15 november 2026)

De vaste host \`bitovastgoed-git-crm-test-bitovastgoed.vercel.app\` laadt vanuit \`src/main.tsx\` uitsluitend \`src/demo/CrmSandboxApp.tsx\` en daaronder de bestaande, pure adres- en samenstellingsproeven.

**Geen productie-auth:** de demo importeert geen \`App.tsx\`, \`AuthProvider\`, \`CrmProtectedApp\`, \`DataStoreProvider\`, Supabase-client of productierepositories. In de demo hoeft de gebruiker zich daarom niet aan te melden.

**Geen productiegegevens:** fictieve objecten en één fictieve belegger zijn in de client gedefinieerd. Matchingbewerkingen zijn uitsluitend client-side. De fictieve instellingen kunnen in \`localStorage\` worden opgeslagen en met 'Herstellen' worden gereset. Het browserwerk is géén volledige CRM-integratietest.

**Geen brede login-bypass:** alle overige hostnames, waaronder productie en andere previewdeployments, laden ongewijzigd \`App.tsx\` met de bestaande beveiligde route. De hostmatch is een exacte vergelijking.

**Waarom niet de normale CRM zonder login?** De previewprojectvariabelen verwijzen nog naar de productiedatabase. Het verwijderen van login uit de normale CRM zou onbedoelde toegang of wijzigingen mogelijk maken. Het vaste testadres laadt daarom een daadwerkelijk gescheiden demo, niet dezelfde live CRM.

**Opmerking:** het Vercel-project blijft voor andere previews gekoppeld aan de productieomgeving. UI-testen met echte CRUD-acties is buiten deze demonstratie niet toegestaan tot er een aparte testdatabase is. GitHub Actions gebruiken tijdelijke PostgreSQL-containers die na de testrun worden verwijderd.

**Routes op de vaste host:** \`/relaties\`, \`/objecten\`, \`/objecten/adresproef\` en \`/objecten/samenstellingproef\`. Andere routes worden naar het fictieve matchingoverzicht geleid.
