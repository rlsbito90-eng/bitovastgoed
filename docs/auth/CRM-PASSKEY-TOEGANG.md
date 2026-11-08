# Bito CRM — Passkeys zonder traditioneel inlogformulier

Status: voorbereid voor veilige gefaseerde ingebruikname. **Niet activeren zonder eerst een passkey op het bestaande adminaccount te registreren.**

## Architectuur
- `/auth`: alleen beveiligde toegang met passkey (Touch ID / apparaat-PIN / hardware key); geen e-mail of wachtwoordvelden.
- `/auth/herstel`: bestaande e-mail/wachtwoordroute voor herstel bij verloren apparaten of uitgeschakelde WebAuthn; niet de standaardroute.
- `ProtectedRoute`, `AuthProvider`, `user_roles` en Supabase RLS blijven actief.
- Bestaande sessies worden automatisch hersteld; incognito kan geen browseropslag van normaal Chrome overnemen. Via WebAuthn kan de eigenaar na een apparaatbevestiging zonder wachtwoord een nieuwe sessie krijgen.
- Vercel Deployment Protection op preview-URL's is onafhankelijk van de CRM-login.

## Eenmalige noodzakelijke Supabase-instellingen (handmatig door projectbeheerder)
Ga naar https://supabase.com/dashboard/project/vyjocdlwfxrblusfngfq/auth/passkeys

1. Zet **Enable Passkey authentication** aan.
2. **Relying Party Display Name:** `Bito Vastgoed CRM`.
3. **Relying Party ID:** `bitovastgoed.vercel.app` (zonder `https://`, poort of pad).
4. **Relying Party Origins:** `https://bitovastgoed.vercel.app`.
5. Sla op. De RP ID later wijzigen verbreekt eerder geregistreerde passkeys. Beperk registratie tot het vaste productieadres, niet tot Vercel preview-URL's.

## Eerste registratie
1. Open het vaste productieadres in normaal Chrome en meld je aan via de bestaande login of, wanneer de passkey-UI al live staat, via `/auth/herstel`.
2. Open het eigen gebruikersmenu linksonder en kies **Passkey / Touch ID instellen**.
3. Volg de browser-/macOS-bevestiging. Deel nooit herstelcodes, wachtwoorden of tokens.
4. Open daarna een nieuw incognitovenster, bezoek `https://bitovastgoed.vercel.app` en kies **Open met Touch ID / passkey**.
5. Controleer ook uitloggen, sessieherstel, adminrechten en een foutscenario zonder passkey. Bij een vergrendeld apparaat moet de CRM-database ontoegankelijk blijven.

## Beperking
WebAuthn vereist een expliciete gebruikersactie op een nieuw privévenster. De app kan een privaat CRM niet zonder enige identiteitscontrole openen. Supabase passkey-ondersteuning is experimenteel (minimaal `@supabase/supabase-js` v2.105), controleer SDK-compatibiliteit en test grondig vóór de definitieve uitrol.

## Herstel
Bij registratie- of aanmeldproblemen kan het bestaande adminaccount via `/auth/herstel` herstellen. Deze route mag niet publiek verwijderd worden voordat er een onafhankelijk, getest herstelkanaal bestaat.

Documentatie: https://supabase.com/docs/guides/auth/passkeys
