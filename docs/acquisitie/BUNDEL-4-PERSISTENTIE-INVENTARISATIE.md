# Bundel 4 — persistentie-inventarisatie

## Doel

Vaststellen welke bestaande opslag leidend blijft voor de gedeelde acquisitiewerkstroom en welke minimale uitbreiding nodig is om Off-Market-signalen en Vastgoedkansen via hetzelfde auditcontract te ondersteunen.

## Bestaande leidende opslag

### `off_market_brieven`

Blijft het actuele operationele briefrecord voor de bestaande Off-Market-flow. De huidige UI gebruikt deze records voor concepten, campagne-stappen, geadresseerden, PDF-generatie, verzending en responsregistratie.

### `off_market_brief_events`

Blijft het append-only auditlog. Het bestaande contract registreert onder meer:

- concept aangemaakt;
- PDF gegenereerd;
- geprint en envelop gereed;
- gepost of verzonden;
- e-mailtekst gekopieerd;
- respons ontvangen;
- retourpost;
- opvolging aangemaakt of afgerond;
- archivering.

De tabel bevat al `brief_id`, `signaal_id`, `geadresseerde_key`, `campagne_stap`, `kanaal`, `event_type`, `event_date`, `status`, `metadata`, `created_by` en `created_at`.

## Besluit

Er wordt geen tweede briefsysteem of tweede eventtabel geïntroduceerd. `off_market_brief_events` wordt dossierbreed gemaakt met een optionele verwijzing naar `vastgoedkansen` en een expliciete dossierbron. Bestaande Off-Market-records blijven geldig en hoeven niet te worden herschreven.

## Minimale uitbreiding

- `vastgoedkans_id uuid null` met foreign key naar `vastgoedkansen(id)`;
- `dossier_type text` met waarden `off_market_signaal` of `vastgoedkans`;
- `relatie_id uuid null` voor de handmatig bevestigde CRM-relatie;
- `brief_nummer smallint null` voor Brief 1–3;
- `respons_status text null`;
- `respons_uitkomst text null`;
- `volgende_actie text null`;
- `volgende_actie_op date null`;
- constraint: precies één van `signaal_id` en `vastgoedkans_id` moet gevuld zijn;
- indexen per dossierbron en op `event_date`.

## Veiligheidsgrenzen

- append-only eventhistorie blijft leidend;
- geen automatische eigenaar- of CRM-koppeling;
- geen automatische PDF-generatie, print of verzending;
- geen automatische dossierstatuswijziging;
- migratie wordt alleen als repositorybestand toegevoegd en niet uitgevoerd;
- productie-Supabase wordt niet benaderd.

## Operationele vervolgstap

Na review en merge kan een aparte shadowproef worden voorbereid. Daarvoor is expliciet akkoord nodig voordat de migratie op shadowproject `xfygspvpeugxowxbcvnm` wordt uitgevoerd.
