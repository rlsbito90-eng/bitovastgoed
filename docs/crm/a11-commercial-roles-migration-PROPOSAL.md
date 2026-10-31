# A11 — Meerdere commerciële rollen per relatie (migratievoorstel)
Status: VOORSTEL. Niet uitvoeren zonder expliciete productie-goedkeuring.

## Exacte additieve SQL (alleen bij akkoord)
```sql
BEGIN;
ALTER TABLE public.relaties
  ADD COLUMN commercial_roles text[] NULL;
ALTER TABLE public.relaties
  ADD CONSTRAINT relaties_commercial_roles_allowed
  CHECK (
    commercial_roles IS NULL OR (
      commercial_roles <@ ARRAY[
        'koper','verkoper','makelaar','bemiddelaar','ontwikkelaar',
        'adviseur','beheerder','financier','overig'
      ]::text[]
      AND array_position(commercial_roles, NULL) IS NULL
    )
  );
COMMIT;
```
Dit is een nieuwe nullable kolom zonder DEFAULT en zonder backfill. Bestaande type_partij en alle 135 relatie-records blijven ongewijzigd.

## Releasevolgorde
1. Controleer recente versleutelde databasekopie, onafhankelijke herstelroute en actuele RLS/grants.
2. Genereer een officiële migratie via `supabase migration new ...` (niet eerder aangemaakt).
3. Review SQL en verkrijg uitdrukkelijk akkoord voor productiewijziging.
4. Voeg kolom met migratie toe, verifieer kolom, RLS, rolvalidatie, row counts en bestaande werkende CRM.
5. Genereer Supabase types opnieuw na schemawijziging; publiceer daarna de appcode op gecontroleerd moment.
6. Test relaties aanmaken/bewerken, rolcombinaties, bestaande zoekprofielen, zoekmatching en mobiel.
Geen nieuwe RLS-policy, geen trigger, geen stored procedure, geen automatische omzetting van headtype.

## Rollback
- **Veiligste operationele rollback:** applicatie terugdraaien; laat de nullable ongebruikte kolom staan.
- **Structurele rollback:** eerst alle ingevulde nieuwe rolwaarden exporteren en verifiëren; daarna desgewenst:
```sql
BEGIN;
ALTER TABLE public.relaties DROP CONSTRAINT IF EXISTS relaties_commercial_roles_allowed;
ALTER TABLE public.relaties DROP COLUMN IF EXISTS commercial_roles;
COMMIT;
```
WAARSCHUWING: dit verwijdert alle inmiddels vastgelegde nieuwe rollen; alleen na nieuwe toestemming en onafhankelijke gegevensback-up.
