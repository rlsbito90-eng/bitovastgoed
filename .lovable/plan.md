# Read-only CSV-export van de CRM-productiedata

Projectref bevestigd: `ljudxyrqoifhfikueric` (uit `supabase/config.toml` en `.env`).

## Wat er gebeurt

Per publieke CRM-tabel wordt één CSV-bestand weggeschreven naar `/mnt/documents/crm-export/`, plus een `MANIFEST.csv` met tabelnaam, aantal geëxporteerde rijen, bestandsnaam en exportstatus.

Er wordt uitsluitend gelezen. Geen wijziging aan database, code, Auth, Storage, Edge Functions, secrets, RLS, policies, cron of configuratie. Geen normalisatie, opschoning, deduplicatie of verrijking: waarden gaan één-op-één mee zoals opgeslagen (UUID's, NULL, timestamps, enums, JSON/JSONB, ruwe tekst).

## Scope

Alle 71 publieke tabellen worden meegenomen. Van de door jou genoemde lijst bestaan alle tabellen; `matches` en `notities` bestaan wel maar zijn leeg (0 rijen) — die krijgen een CSV met alleen de kolomkoppen en status `leeg`.

Grootste tabellen: `off_market_signalen_ruw` (22.870), `off_market_ai_runs` (886), `off_market_signalen` (880), `off_market_brief_events` (373), `property_subtypes` (263), `referentie_objecten` (238), `taken` (141), `relaties` (126).

Niet in deze stap: `auth`-schema, `storage`-schema, Supabase-systeemtabellen, secrets.

## Technische aanpak

- Export via `psql` met `COPY (SELECT * FROM public.<tabel>) TO STDOUT WITH CSV HEADER` per tabel, één bestand per tabel.
- NULL blijft onderscheiden van lege string via de standaard CSV-NULL-representatie (leeg veld zonder quotes vs. `""`).
- Bestandsnaam: `<tabelnaam>.csv`.
- Manifest wordt na afloop gegenereerd uit de werkelijke regeltellingen van de geschreven bestanden, niet uit de vooraf gemeten tellingen, zodat afwijkingen zichtbaar worden.
- Elke tabel wordt afzonderlijk geëxporteerd; een fout op één tabel blokkeert de rest niet en krijgt status `mislukt` met reden.

## Oplevering

- `/mnt/documents/crm-export/<tabel>.csv` (71 bestanden)
- `/mnt/documents/crm-export/MANIFEST.csv`
- Korte samenvatting in de chat met totalen en eventuele mislukte tabellen.
