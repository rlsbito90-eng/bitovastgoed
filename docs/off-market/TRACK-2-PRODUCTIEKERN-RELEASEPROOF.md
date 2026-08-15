# TRACK-2 — Productiekern releaseproof

Datum: 15 augustus 2026

## Doel

Dit document legt het actuele technische bewijs vast voor TRACK-2: de bestaande BR/BAT-acquisitieproductiekern opnieuw valideren tegen de actuele `main`, zonder productie-Supabase te wijzigen.

## Basis

- Basiscommit `main`: `d2b98268ff74f39f6e675baa0de5d84065def746`.
- Releaseproofbranch: `feat/track-2-productiekern-releaseproof`.
- De inhoudelijke productiekern-releasebronnen zijn ongewijzigd gebleven; TRACK-2 opent uitsluitend de bestaande bewijsworkflows voor deze releaseproofbranch.

## Bewijs 1 — geïsoleerde database- en releaseproof

GitHub Actions run: `31888640703` — **groen**.

Alle stappen zijn geslaagd:

1. kern-SQL-drafts, rollback, concurrency en idempotentie;
2. volledige geïsoleerde dagelijkse E2E-acceptatie;
3. autorisatie en actor-spoofing;
4. least-privilege activatiebewijs;
5. gegenereerde releasekandidaat zonder activatie;
6. archivering van de review-only releasekandidaat.

Nieuw bewijsartifact:

- naam: `acquisitie-productiekern-release-candidate`;
- artifact-id: `9247944081`;
- SHA-256: `d6f64d46816215e6f09abd380b822104027d55c2961f38e01eb595fff28f6fb5`;
- vervaldatum artifact: 29 augustus 2026.

## Bewijs 2 — actuele productiekerncode

GitHub Actions run: `31888645459` — **groen**.

De bestaande `verify:acquisitie-productiekern` poort is volledig geslaagd en omvat:

- TypeScript typecheck (`tsc --noEmit`);
- gerichte productiekern-Vitest-suite;
- production Vite build.

## Productiegrens

Dit bewijs verleent **geen automatisch productieakkoord**.

Niet uitgevoerd:

- geen Supabase-migratie;
- geen tabellen, constraints of functies in productie aangemaakt of gewijzigd;
- geen RLS/policies/grants gewijzigd;
- geen backfill;
- geen Productiekern-readactivatie;
- geen Productiekern-writeactivatie;
- geen Kadasteractie;
- geen productiedatawrite.

## TRACK-2 conclusie

**Technische status: GO voor een afzonderlijke productie-installatiebeslissing.**

**Productiestatus: NO-GO zonder expliciet akkoord.**

De eerstvolgende gevoelige stap is het daadwerkelijk installeren van het bewezen structuur-/functiereleasepakket in de CRM-productiedatabase. Activatie van reads/writes, RLS/grants en eventuele backfill blijven daarna nog afzonderlijke poorten en mogen niet impliciet met de installatie worden meegenomen.
