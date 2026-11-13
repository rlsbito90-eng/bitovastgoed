# Centrale previewaanmelding — Bito CRM

## Doel
Op willekeurige Vercel-previewdeployments van **dit** project aanmelden met de passkey op het vaste CRM-adres, zonder e-mailadres/wachtwoord bij elke nieuwe preview.

## Beveiligingsgrenzen
- Het vaste CRM `https://bitovastgoed.vercel.app` is het **enige** WebAuthn/Touch ID-domein.
- Een preview opent daar een popup. De aanmelding gebeurt via een **beveiligde browseractie**, niet met een token in de URL.
- Een Supabase Edge Function verifieert: browser-Origin = vaste CRM; bestaand geldig Supabase account; **admin** in `user_roles`; cryptografisch willekeurige nonce; en **realtime** via Vercel API dat het previewadres bij het vastgelegde Bito-project hoort, READY is, en een GitHub-previewbranch is.
- Vervolgens geeft Supabase een eenmalige magiclink-tokenhash uit. Dit wordt via `window.opener.postMessage` alleen naar het geverifieerde preview-origin gestuurd. De preview gebruikt `supabase.auth.verifyOtp` en krijgt zo een **aparte Supabase-sessie**.
- Verkeerde/nieuwe/buitenlandse host, verlopen OTP, verkeerde gebruiker, uitgeschakelde Edge Function, ontbrekende Vercel-leessleutel: **geen toegang**. Bestaande `ProtectedRoute`, rollen en RLS blijven ongewijzigd.
- Een Vercel-preview is uitvoerbare code en ontvangt zijn eigen sessie. **Alleen previews openen waarvan de branch/code vertrouwd is.** Een bij Vercel behorende preview kan alsnog onbetrouwbare code bevatten als iemand onveilige wijzigingen commit. De deployment-controle bewijst eigenaarschap, niet de veiligheid van alle uitvoerbare scripts.
- Vercel Authentication blijft aan. De nieuwe koppeling vervangt geen Vercel-login wanneer Vercel een browser extra wil authentiseren. Vercel-cookies kunnen per deployment/URL verschillen.

## Vereiste secret (voor ingebruikname)
Er is één **server-side**, beperkt Vercel API-token nodig. De eigenaar maakt dit aan in Vercel accountinstellingen en zet het **zelf** in:

**Supabase Dashboard → Project → Edge Functions → Secrets**
- Name: `VERCEL_PREVIEW_AUTH_READ_TOKEN`
- Value: nieuw Vercel API-token met alleen de noodzakelijke rechten om deployments te **lezen** binnen Bito Vastgoed (geen deploy-, write- of managementrecht).
- Dit token nooit in ChatGPT, GitHub, logs of `VITE_*`-variabelen plakken; het hoort uitsluitend in Supabase Edge Function secrets. Na invullen is er geen wijziging aan het Vite-frontend nodig.

Verificatie / eigenaarstoken:
- Team `team_v2sTCHBAV9BqdVuI2fn0zy46`
- Project `prj_oU7EipRl3D0tgO8RN1Wowv2rHhbh`
- GitHub `rlsbito90-eng/bitovastgoed`

## Ingebruikname
1. Controleer dat de eerste Touch ID/passkey op het **vaste CRM-adres** werkt. De bestaande login via `/auth/herstel` blijft aanwezig.
2. Controleer dat de Edge Function `crm-preview-session` is gedeployed met `verify_jwt: true`. Zonder het secret moet hij veilig `503 preview_auth_not_configured` opleveren.
3. Sla het genoemde Vercel-token op als Supabase Edge Function Secret. Beperk rechten tot alleen lezen.
4. Zorg dat de te testen previewbranch de nieuwe frontendcode bevat. **Oude previewbuilds hebben nog geen knop voor centrale aanmelding**, totdat ze zijn bijgewerkt.
5. Open een nieuw previewadres, klik `Aanmelden via Touch ID`. In de popup op het vaste adres bevestig je de aanvraag. Na bevestiging wordt de preview met eigen Supabase-sessie geopend.
6. Test een niet-bestaande of vreemde previewhost (moet worden geweigerd), hetzelfde nonce dubbel gebruiken (moet worden genegeerd), een niet-adminaccount (moet worden geweigerd), uitloggen en de wachtwoordherstelroute.
7. Vercel Deployment Protection moet **ingeschakeld blijven** en kan een aparte Vercel-inlogstap vereisen (met name incognito).

## Operationeel
- Tokens worden niet via querystring of fragment doorgegeven.
- Edge Function logt geen persoonsgegevens of tokens.
- Alleen `https://bitovastgoed.vercel.app` krijgt browser-CORS-toegang.
- In het popupvenster is een expliciete bevestiging vereist; als er nog geen bestaande sessie is, wordt eerst een passkey gebruikt.
- Eenmalige magic-link-tokens worden door Supabase gevalideerd en verbruikt. De precieze geldigheidsduur volgt de Supabase-authenticatieconfiguratie; client accepteert maar één antwoord per aanvraag.
- Geen automatische bypass van Vercel Deployment Protection. Buiten de Vercel-authenticatie worden geen gebruikersnamen of wachtwoorden voor CRM gevraagd tenzij herstel nodig is.

## Test en rollback
- Geautomatiseerde tests, TypeScript en build via GitHub CI.
- Browsercontrole blijft nodig: Chrome normaal en incognito, popup-blocker, preview met actieve Vercel Authentication.
- Rollback: verwijder `VERCEL_PREVIEW_AUTH_READ_TOKEN` uit Supabase Secrets of deactiveer `crm-preview-session`. De popupaanmelding faalt gesloten; de bestaande `/auth/herstel`-route blijft functioneren.
