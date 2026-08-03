# BAG BUILD 2A.14 — shadow-authenticatieautoriteit

## Aanleiding

De CRM-sessie en `user_roles` bestaan in Supabase-productieproject
`ljudxyrqoifhfikueric`, terwijl de BAG-queryfunctie en BAG-data op het afgescheiden
shadowproject `xfygspvpeugxowxbcvnm` draaien. De standaard Edge-gateway van het
shadowproject kan een productietoken niet als eigen JWT behandelen.

## Oplossing

De Edge Function blijft uitsluitend op shadow draaien en blijft uitsluitend met
de shadowdatabase verbinden. Voor authenticatie gebruikt zij twee expliciete
servervariabelen:

- `BAG_AUTH_SUPABASE_URL`, exact gebonden aan
  `https://ljudxyrqoifhfikueric.supabase.co`;
- `BAG_AUTH_SUPABASE_ANON_KEY`, de publieke clientkey van diezelfde
  CRM-authenticatieautoriteit.

De functie verifieert zelf de bearer-JWT via `getClaims()` en controleert daarna
in diezelfde CRM-autoriteit of de gebruiker `admin` of `medewerker` is. Daarom
moet de shadowdeployment de platformoptie `verify_jwt=false` gebruiken: de
standaard shadow-gateway kent de productiesleutels niet, maar de functie laat
geen request door zonder haar eigen volledige JWT- en rolcontrole.

## Veiligheidsgrens

- productie ontvangt geen schema-, functie- of configuratiewijziging;
- de productie-auth-URL is hard fail-closed en kan niet naar een willekeurige
  autoriteit worden omgezet;
- de browser ontvangt geen databasecredential of extra sleutel;
- de BAG-database-URL blijft exact aan shadow en `bag_gateway` gebonden;
- ontbrekende variabelen leveren een gesloten `503` op;
- frontendfeatureflags blijven uit totdat credentialplaatsing en een echte
  interne sessietest groen zijn.
