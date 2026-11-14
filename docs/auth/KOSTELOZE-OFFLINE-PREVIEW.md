# Geen-login CRM-UI-preview (kosteloos)

## Status en doel
Dit is een **lokale demonstratiemodus** voor Vercel-previewbuilds. In deze modus komt de bezoeker meteen in de bestaande CRM-interface, met een fictieve demo-gebruiker en lokale testrecords. Het is GEEN echte gedeelde CRM-database, en geen functionele end-to-end test van Supabase, beveiliging, integraties, bestanden, berichten, e-mail of cronjobs.

Geen extra Supabase-branch of abonnement nodig.

## Veiligheidsgrenzen
- Activeer uitsluitend op Vercel-target `preview`: `VITE_NOLOGIN_PREVIEW=true`. Laat de variabele op production en development **weg**.
- De frontend verlangt bovendien een previewhost van de vorm `https://bitovastgoed-...-bitovastgoed.vercel.app`.
- De echte Supabase-client wordt in deze modus **niet aangemaakt**. De CRM-app gebruikt in plaats daarvan een lokale in-memory/localStorage simulator zonder netwerkaanroepen. Een fictieve accountsessie en fictieve rollen zijn **geen toegang** tot de echte database.
- Banner: `TESTOMGEVING · fictieve gegevens · uitsluitend lokaal in deze browser · geen verbinding met het echte CRM`.
- Gegevens verschillen per browser, incognito of previewhost; ze synchroniseren niet met productie of andere apparaten.
- Bepaalde gespecialiseerde API-functies en applicatieschermen zijn niet ondersteund in de offline demo. Niet gebruiken om de productieprocessen of RLS te valideren.

## Uitrol
1. Zet Vercel-projectomgevingvariabele `VITE_NOLOGIN_PREVIEW` op `true` met target `preview`, **niet production**.
2. Bouw een nieuwe GitHub preview; oude deployments krijgen de bouwvariabele niet achteraf.
3. Test incognito de nieuwe preview: geen Vercel-login, geen Bito-login, dashboard, fictieve relaties, objecten, taken en deals.
4. Voeg lokaal een testrelatie toe en ververs: deze is uitsluitend op dezelfde browser/host aanwezig.
5. Test `https://bitovastgoed.vercel.app`: bestaande echte CRM-authenticatie intact.

## Rollback
Verwijder de previewvariabele `VITE_NOLOGIN_PREVIEW` of zet op false, deploy opnieuw. Dan is de normale CRM-authenticatie terug op previews. Productie blijft steeds ongewijzigd.

## Niet doen
- Zet nooit `AUTH_DISABLED = true` in productie.
- Geef nooit publieke `anon`-rechten op productie-CRM-tabellen om de demo te laten werken.
- Kopieer nooit echte CRM-contacten of dossiers naar publieke previews.
