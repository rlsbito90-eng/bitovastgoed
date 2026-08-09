# CRM-MIG-2A

Deze bundel bevat uitsluitend migratievoorbereiding:

- `CRM-MIG-2A-SCHEMA-GAP.md` — vastgelegde read-only diagnose van het zelfstandige CRM-doelproject;
- `CRM-MIG-2A-CHECKLIST.md` — review- en veiligheidschecklist;
- `scripts/migratie/crm-schema-gap-readonly.sql` — reproduceerbare read-only metadata-probe;
- `src/test/migratie/crmSchemaGapReadonlyProbe.test.ts` — contracttest die muterende top-level SQL in de probe blokkeert.

De bundel installeert geen schema, kopieert geen data en deployt geen Edge Functions.
