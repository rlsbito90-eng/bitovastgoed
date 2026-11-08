# Website → CRM: investeringsprofiel (fase 3A)

**Stand 8 november 2026:** ontvanger en afgeschermde inbox voorbereid.
De inzendingen op bitovastgoed.nl blijven voorlopig ongewijzigd; de WordPress-bridge v0.1.0 is **geïnstalleerd maar inactief**, dus nog geen live gegevensstroom.

## Onderzocht

- Website: `bitovastgoed.nl` op WordPress.com Atomic.
- Formulier: Contact Form 7 (titel **Investeringsprofiel vastgoed**), op de WordPress pagina `/investeringsprofiel/` via shortcode `[contact-form-7 id="d556c06" title="Investeringsprofiel vastgoed"]`.
- Flamingo is actief voor het bewaren van inzendingen.
- Bito CRM: Vite/React met Supabase; **Relaties** is het primaire investeringsprofiel, extra Zoekprofielen zijn optioneel.
- De gebruiker heeft op 8 november 2026 de interne CF7-veldkeys via screenshots bevestigd: **naam `your-name`**, **e-mail `your-email`**, **telefoon `telephone`**, **bedrijf `company`**. De overige keuzevelden zijn nog niet allemaal geverifieerd; die worden bij een veilige proefinzending op brongetrouwheid gecontroleerd.

## Ontwerp

1. Een succesvolle, niet-afgewezen CF7-mailinzending triggert uitsluitend op de geselecteerde formuliertitel een WordPress server-to-server HTTP POST.
2. WordPress verzendt volledige veldwaarden naar de Supabase Edge Function `website-investor-intake` en houdt het formulier en de originele mail/Flamingo intact.
3. Server accepteert uitsluitend JSON, HTTPS-tokens, maximale 64 KiB, timestamp binnen 5 minuten, eenmalig `event_id` (unieke bron-event-index), geldige naam/e-mail, juiste WordPress-bron en juiste formuliertitel.
4. Geheim wordt alleen binnen WordPress als admin-instelling bewaard. In de CRM-database staat alleen SHA-256 van de sleutel; service_role is de enige databaselezer van deze hash.
5. De functie doet een *exacte* e-mailvergelijking binnen Relaties en contactpersonen. Status: `nieuw_te_controleren`, `bestaande_relatie` of `dubbelzinnig`. Bestaande contacten worden **niet** overschreven.
6. Volledig brondocument in `website_investor_intakes.raw_payload`, alleen zichtbaar voor interne CRM-gebruikers via RLS. De relationele startpagina toont een compacte, aanvankelijk gesloten beoordelingsinbox.
7. Geen automatische inschrijving in `relaties` of `zoekprofielen` totdat de veldmapping en echte testinzending correct en brongetrouw zijn geverifieerd.

## Productstatus

- De nieuwe tabellen + RLS zijn toegepast in live Supabase-project `vyjocdlwfxrblusfngfq` (migratie `20261108093225`).
- De Edge Function `website-investor-intake` is afzonderlijk naar dat project gedeployed, `verify_jwt=false` **maar met eigen verplichte authenticatie**.
- Op 8 november 2026 is de servercredential **`enabled=true`** gezet, nadat de hex-sleutel uit het privébestand overeenkwam met de SHA-256-hash in Supabase. De ontvangstfunctie verwerkt alleen geldige serververzoeken en schrijft uitsluitend naar de intake-inbox, niet naar Relaties. WordPress-uitgaande verzending vereist **afzonderlijk** inschakelen in de plug-ininstellingen.
- WordPress plug-in Bito CRM — Investeringsprofiel v0.1.0 is door de gebruiker **geactiveerd** (status bevestigd via WordPress-connector). Het selectievakje voor uitgaande verzending staat standaard uit tot de gebruiker dit inschakelt in **Instellingen → Bito CRM-koppeling**. De plug-in is een lokaal gegenereerde, niet-openbaar gehoste ZIP; SHA-256 `977590b3dcf11e4f0ee9792a8a2e0fbb687470c1fe0de074740989c29d4d4627`.
- Losse geheime koppelsleutel wordt nooit in Git, de app-frontend of in dit document opgeslagen. De gebruiker krijgt hiervoor een afzonderlijk privébestand.

## Vrijgaveprocedure

1. CF7-veldnamen gecontroleerd via screenshots: `your-name`, `your-email`, `telephone`; organisatie `company` wordt als bronveld bewaard.
2. WordPress-plug-in is actief, servercredential staat aan; de uitgaande WordPress-schakelaar staat standaard uit.
3. WordPress → Instellingen → Bito CRM-koppeling: voer `your-name`, `your-email`, `telephone` en de privé-webhooksleutel in. Opslaan. Schakel vervolgens "Ingeschakeld" in voor de expliciet gecontroleerde proefinzending.
4. Controleer onder WordPress de status "Ingeschakeld" en verzend een door de gebruiker beheerde testidentiteit (geen echte belegger).
5. Doe één proefinzending met een fictieve naam en test-e-mail onder eigen beheer. Verifieer registratie in `website_investor_intakes`, de juiste velden en status in Relaties, de Flamingo-ontvangst en geen extra echte relatie of Zoekprofiel.
6. Controleer of een replay met identiek `event_id` slechts één rij maakt. Herhaal met bestaand CRM-mailadres zonder dat oude aankoopcriteria overschreven worden.
7. Pas na deze acceptatie de exacte formuliervelden omzetten naar centrale CRM-velden en de gecontroleerde route bouwen voor **automatisch nieuwe relaties**. Bestaande contacten blijven beoordeelbaar. Hierna integratietests en aparte vrijgave.

## Security-opmerkingen

- `website_intake_credentials`: RLS ingeschakeld, **geen gebruikerspolicies**, geen grants aan `anon/authenticated`; uitsluitend service_role.
- `website_investor_intakes`: RLS interne gebruikers en geen externe inserts. Publiceren van de ontvangstfunctie `verify_jwt=false` is uitsluitend aanvaardbaar met de eigen hoge-entropie authenticatie; zonder sleutel kan niemand data in het CRM plaatsen.
- Geen secrets in code of URL, geen PII in application-logs.
- CF7/Flamingo blijven de primaire back-up bij eventuele afleverschade; automatische aflever-retries staan nog op de later te implementeren betrouwbaarheidstaken.
- Privacyverklaring en bewaartermijnen controleren vóór inschakeling.

