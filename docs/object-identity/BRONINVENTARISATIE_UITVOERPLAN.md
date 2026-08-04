# Object-ID broninventarisatie — read-only uitvoerplan

## Doel

Dit uitvoerplan maakt de latere broninventarisatie voorspelbaar en begrensd. Het voert zelf geen databasequery uit en bevat geen databasewrites.

## Vaste grenzen

- uitsluitend `SELECT`;
- vijf bekende CRM-bronnen;
- expliciete kolomselectie uit de bronadapters;
- standaard 500 records per pagina;
- maximaal 100.000 records per bron per run;
- een fout in één bron blokkeert of vervuilt de andere bronresultaten niet;
- nul automatische samenvoegingen;
- nul mutaties in productie of shadow;
- geen Kadasteraanvraag.

## Stop/go-volgorde

1. schema-/kolompreflight moet `preflight_ready` zijn;
2. uitvoerplan wordt gegenereerd;
3. iedere bron wordt afzonderlijk en gepagineerd gelezen;
4. iedere pagina wordt op omvang en broncontext gevalideerd;
5. bronrecords worden via de vaste adapter vertaald;
6. het inventarisatierapport wordt opgebouwd;
7. bij ambiguïteit of ontbrekende identiteit blijft de status fail-closed;
8. een muterende backfill vereist een afzonderlijke BUILD en expliciete goedkeuring.

## Niet toegestaan

- `select *`;
- onbegrensde bulkreads;
- automatische adrescorrectie;
- BAG-ID's gokken;
- bestaande dossiers automatisch samenvoegen;
- schrijven naar `crm_objectregistraties` of `crm_objectbronkoppelingen`.
