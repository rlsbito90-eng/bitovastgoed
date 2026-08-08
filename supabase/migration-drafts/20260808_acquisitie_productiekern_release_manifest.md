# Acquisitieproductiekern — review-only releasemanifest

**Status:** review-only. Dit manifest voert niets uit en verleent geen productieakkoord.

De bewezen SQL-drafts blijven bewust buiten `supabase/migrations` en eindigen met `ROLLBACK`. Promotie naar uitvoerbare migraties mag pas plaatsvinden na technische review en een afzonderlijke expliciete productiebeslissing.

## Migratiepakket — volgorde

De toekomstige **structuur-/functiepromotie** moet deze volgorde behouden:

1. `20260806_acquisitie_productiekern_build_a.sql`
   - nummerreeksen;
   - briefversies;
   - printbatches en batch↔briefversie;
   - batchdocumenten;
   - productieaudit;
   - atomische nummerfuncties;
   - bron-blob SHA tijdens manifestopmaak: `b363c8fa81db4f400a500cae47522acc463e8a09`.

2. `20260806_acquisitie_productiekern_dossier_briefkern.sql`
   - canoniek acquisitiedossier;
   - compatibele uitbreiding van `off_market_brieven`;
   - legacy `verstuurd` blijft geldig;
   - geen automatische backfill;
   - bron-blob SHA: `86789d2aca2729b216019bd55cce3826318f4aca`.

3. `20260808_acquisitie_productiekern_vroege_transactionele_functies.sql`
   - verwerking starten;
   - brief reserveren;
   - briefversie aanmaken;
   - printbatch aanmaken;
   - briefversie aan batch toevoegen;
   - bron-blob SHA: `0acf52aa7273fceabbc0e675d54acdea68e8b892`.

4. `20260806_acquisitie_productiekern_transactionele_functies.sql`
   - brief definitief maken;
   - batchdocumenten registreren;
   - batch geprint markeren;
   - brief gepost markeren;
   - bron-blob SHA: `7f4294417589c0e8fb3da14c239ce65e370895fd`.

5. `20260808_acquisitie_productiekern_security_wrappers.sql`
   - interne actor-assertie;
   - bewezen RPC-implementaties hernoemen naar `*_intern`;
   - publieke security-wrappers creëren;
   - helper en interne implementaties niet client-callable houden;
   - **geen client-grants**;
   - bron-blob SHA: `66f0428089b1602952686827baca3d82545d6cd8`.

## Niet opnemen in hetzelfde migratiepakket

`20260808_acquisitie_productiekern_activatie_security.sql`

Deze draft is **geen onderdeel van de structuur-/functiepromotie**. Zij bevat toekomstige `SELECT`-grants, RLS-policies en `EXECUTE`-grants en vormt daarom een afzonderlijke activatiepoort.

Bron-blob SHA: `3f91d406fc19c5281b371a34aa75149b1d928c32`.

Activatie mag uitsluitend plaatsvinden nadat:

- de definitieve structuur-/functiemigraties technisch zijn gereviewd;
- geïsoleerde migratie-, concurrency- en securityproeven op de definitieve releasebestanden groen zijn;
- handmatige previewacceptatie groen is;
- finale regressie/typecheck/build is vastgelegd;
- een afzonderlijk expliciet productieakkoord is gegeven.

## Promotieregels

Bij het later afleiden van uitvoerbare migraties gelden minimaal deze regels:

1. verwijder nooit alleen mechanisch de afsluitende `ROLLBACK` uit de drafts;
2. behoud de bewezen statementvolgorde en functie-signatures;
3. introduceer geen backfill in hetzelfde pakket;
4. verander bestaande `off_market_brieven`-RLS/policies/grants niet stilzwijgend;
5. voeg activatiegrants/RLS niet samen met schema-/functiepromotie;
6. voer de definitieve releasebestanden opnieuw uit in tijdelijke PostgreSQL voordat productie überhaupt bespreekbaar wordt;
7. elke inhoudelijke afwijking van een bron-draft vereist nieuwe gerichte tests en DB/securityproof.

## Huidige beslissing

**GO:** review-only releasevoorbereiding.

**NO-GO:** uitvoerbare productiemigratie, backfill, RLS/grantsactivatie, read-activatie of Productiekernwrites.
