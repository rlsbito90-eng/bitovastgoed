# Bito CRM — geïsoleerde inlogvrije previews (voorbereiding)

## Doel
Previews moeten het dashboard zonder login, wachtwoord of Touch ID kunnen openen, met **fictieve data**. Productie blijft volledig op Supabase-authenticatie en RLS werken.

## Huidige status
- De frontendcode is voorbereid, maar staat **uit** totdat het Supabase-testproject en de Vercel-previewvariabelen zijn ingericht.
- Bestaande Vercel-variabelen `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` gelden op dit moment **zowel voor productie als preview**. Dit moet vóór activering worden gescheiden.
- De Supabase-connector toont één actief CRM-project en een inactief project `bito-bag-shadow` (dat laatste is niet automatisch een CRM-testomgeving en wordt NIET hergebruikt).
- De actuele Supabase-prijsopgave voor een ontwikkelbranch is **$0,01344/uur** (~$9,81/maand bij 730 uur). Maak geen nieuwe betaalde branch zonder expliciete goedkeuring.

## Technisch mechanisme
- `IS_ISOLATED_PREVIEW_SANDBOX` is alleen waar als **alle** voorwaarden gelden:
  1. Buildinstelling `VITE_PREVIEW_SANDBOX_MODE=true`.
  2. Exact Vercel-previewdomein voor het project; nooit `bitovastgoed.vercel.app`.
  3. `VITE_PREVIEW_SANDBOX_PROJECT_REF` met een apart, 20-karakter Supabase-project-ID.
  4. `VITE_SUPABASE_URL` moet exact naar dat project wijzen, op HTTPS en zonder extra pad.
  5. Bekende productieprojecten (`vyjocdlwfxrblusfngfq` en `ljudxyrqoifhfikueric`) worden expliciet geweigerd.
- Als het veilig geactiveerd is, meldt de preview automatisch anoniem aan bij **dat afzonderlijke Supabase-project**. Het normale aanmeldscherm wordt niet geopend.
- De frontend behandelt een anonieme demosessie uitsluitend in deze sandbox als interne demo. De **eigen testdatabase moet alsnog RLS- en autorisatieregels toepassen**; clientrolgebruik is nooit echte serverbeveiliging.
- Zonder afzonderlijke database wordt dit niet aangezet. Als de anonieme authenticatie mislukt, volgt een configuratiemelding, niet een anonieme toegang tot productie.

## Uitrol na akkoord op de kosten
1. Maak een nieuwe Supabase-ontwikkelbranch op basis van de **daadwerkelijke CRM-database** met `with_data=false`; controleer dat er geen echte persoonsgegevens uit productie overkomen.
2. Controleer alle tabellen en RLS in deze ontwikkelbranch.
3. Schakel **Anonymous sign-ins** uitsluitend op die testbranch in.
4. Geef **uitsluitend in de testbranch** anonieme gastgebruikers de noodzakelijke rechten op fictieve testgegevens. Voorkom dat zulke policies of triggers terechtkomen in het productie-migratiepad.
5. Maak minimaal één fictieve relatie, één object, één taak en één deal aan. Gebruik geen echte adres-, e-mail- of dossiergegevens.
6. Zet alleen voor Vercel-omgeving **preview**: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL` en `VITE_SUPABASE_PUBLISHABLE_KEY` naar het nieuwe testproject; voeg `VITE_PREVIEW_SANDBOX_PROJECT_REF` en `VITE_PREVIEW_SANDBOX_MODE=true` toe. **Raak de production-target waarden niet aan.**
7. Controleer een nieuwe preview in incognito: dashboard zonder login en fictieve records zichtbaar/bewerkbaar; verifieer dat oude productie-CRM-records ontbreken.
8. Controleer productie afzonderlijk: bestaande loginvereisten en RLS nog actief, echte CRM-records blijven afgeschermd.
9. Rol de nieuwe configuratie pas uit naar andere previewbranches na geslaagde end-to-end test.

## Productiebeveiliging
- Geen `AUTH_DISABLED=true` en geen publieke `anon`-policies in de echte CRM-database.
- Geen service_role-key in Vite, GitHub, Vercel-clientvariabelen of frontends.
- Maak bij deploycontrole het echte project-ID zichtbaar in *metadatacontroles*, maar log nooit sleutels of sessietokens.
- In de preview wordt permanent `TESTOMGEVING · fictieve gegevens` getoond.

## Rollback
Verwijder de preview-only `VITE_PREVIEW_SANDBOX_MODE`-variabele (of zet op `false`) en redeploy de preview. De normale CRM-authenticatie keert dan terug. Zet productie nooit op een testdatabase.
