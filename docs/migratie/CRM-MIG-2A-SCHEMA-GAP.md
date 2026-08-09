# CRM-MIG-2A — read-only schema-gap

Status: diagnose / migratievoorbereiding. Dit document voert niets uit.

## Doel en harde grens

Doelproject voor de zelfstandige CRM-migratie:

`vyjocdlwfxrblusfngfq`

Beschermde projecten:

- `ljudxyrqoifhfikueric` — voormalige Lovable CRM-productie; uitsluitend migratiebron, niet wijzigen;
- `wzkhmjuasyuvzhhycnym` — Lovable-shadow; niet gebruiken;
- `xfygspvpeugxowxbcvnm` — uitsluitend BAG; nooit CRM-doel.

Alle bevindingen hieronder zijn verkregen met read-only metadataqueries op `vyjocdlwfxrblusfngfq` en vergelijking met het actuele repositorycontract in `src/integrations/supabase/types.ts`. Er is geen migratie, DDL, data-import, function-deploy of secretwijziging uitgevoerd.

## Uitkomst op hoofdlijnen

Het actuele repositorycontract beschrijft:

- 72 public tabellen;
- 4 public views;
- 6 application-facing functions/RPC's in de gegenereerde types;
- 69 public enumtypen.

Het doelproject bevat momenteel:

- 22 public tabellen;
- 1 public view;
- 6 public databasefuncties totaal;
- 21 public enumtypen;
- 0 Auth-users;
- 1 Storage-bucket;
- 0 Storage-objecten;
- 0 Edge Functions.

Van de 72 verwachte tabellen zijn er 21 aanwezig. Er ontbreken 51 verwachte tabellen. Daarnaast staat `acquisitie_checkins` op het doelproject terwijl die niet in het actuele gegenereerde typecontract voorkomt.

## Ontbrekende verwachte tabellen

### Acquisitie / Vastgoedkansen

- `acquisitie_campagnes`
- `acquisitie_gebiedsvoorkeuren`
- `acquisitie_targets`
- `vastgoedkansen`

### Off-Market Radar / Acquisitieselectie

- `off_market_acquisitie_selectie`
- `off_market_ai_runs`
- `off_market_brief_events`
- `off_market_brieven`
- `off_market_bronnen`
- `off_market_import_runs`
- `off_market_kadaster_checks`
- `off_market_signalen`
- `off_market_signalen_ruw`

### Vastgoedrekenen

- `calculation_acquisition_components`
- `calculation_acquisition_unit_links`
- `calculation_components`
- `calculation_outputs`
- `calculation_scenarios`
- `comparative_valuation_references`
- `comparative_valuations`
- `exit_assumptions`
- `real_estate_calculations`
- `residential_wws_units`
- `risk_analysis`
- `scenario_costs`
- `scenario_financing_facilities`
- `scenario_kengetal_contexts`
- `scenario_kengetal_profile_applications`
- `scenario_kengetal_snapshots`
- `sell_off_units`
- `user_calculation_preferences`
- `vastgoedrekenen_bronimport_mapping_profielen`
- `vastgoedrekenen_bronimport_runs`
- `vastgoedrekenen_bronpakketten`
- `vastgoedrekenen_kengetallen`
- `vastgoedrekenen_tax_settings`
- `vastgoedrekenen_taxonomie_opties`

### CRM / object- en dealmodel

- `biedingen`
- `contact_moments`
- `deal_types`
- `kadaster_data_records`
- `kadaster_documenten`
- `object_aanbiedingsteksten`
- `object_aandachtspunten`
- `object_dossier_items`
- `object_pipeline`
- `pipeline_stages`
- `pipelines`
- `property_subtypes`
- `property_type_aliases`
- `property_types`

## Bestaande tabellen zijn niet automatisch schema-equivalent

Ook de 21 overlappende tabellen mogen niet als gereed worden beschouwd. De read-only kolominventaris laat drift zien. Voorbeelden:

- `deals` mist onder meer archiveer-/closingvelden uit het actuele contract;
- `object_fotos` mist `focus_x`, `focus_y`, `is_plattegrond` en `updated_at`;
- `object_subcategorieen` mist timestampvelden uit het actuele contract;
- `objecten` loopt substantieel achter op het actuele objectcontract;
- `referentie_objecten` mist aanvullende bron-, waarde- en transactiemetadata;
- `relatie_contactpersonen` mist onder meer `telefoon_mobiel`;
- `relaties` mist de huidige property/deal-typekoppelingen;
- `taken` mist `off_market_signaal_id`;
- `zoekprofielen` mist de actuele property/deal-typevelden.

Daarom is een tabelnaam-match geen bewijs van schema-equivalentie.

## Views en functions/RPC's

Verwachte public views volgens het actuele typecontract:

- `object_huur_metrics`
- `view_acquisitie_gebiedsfrequentie`
- `view_off_market_dealpotentie`
- `view_off_market_kpi`

Aanwezig op `vyjoc...`:

- `object_huur_metrics`

De application-facing functions/RPC's in het actuele typecontract zijn:

- `has_role`
- `off_market_bron_stats`
- `off_market_promote_to_object`
- `vastgoedrekenen_bronimport_mapping_geldig`
- `vastgoedrekenen_import_codes_valid`
- `vastgoedrekenen_import_kengetallen`

Op `vyjoc...` zijn momenteel databasefuncties aanwezig met de namen:

- `generate_refnummer`
- `handle_new_user`
- `has_role`
- `is_intern_gebruiker`
- `rls_auto_enable`
- `update_updated_at_column`

Dit is dus geen function/RPC-equivalentie.

## Enumdrift

Het actuele repositorycontract bevat 69 public enumtypen. Het doelproject bevat 21 public enumtypen. Het doelproject bevat bovendien het oudere enumtype `energielabel`, terwijl het actuele contract onder meer `energielabel_v2` gebruikt. Enum-equivalentie moet daarom expliciet onderdeel zijn van de schema-opbouw.

## Migratiehistorie is niet betrouwbaar als replay-startpunt

`supabase_migrations.schema_migrations` op `vyjoc...` bevat tijdens deze probe slechts één geregistreerde migratie:

- `20260506185121_create_acquisitie_checkins`

Tegelijk bestaan er 22 public tabellen. De database-inhoud en de geregistreerde migratiehistorie lopen dus niet één-op-één gelijk.

**Gevolg:** niet blind alle repositorymigraties vanaf een datum uitvoeren. Eerst moet per migratiebundel worden vastgesteld of objecten al bestaan, of hun definitie gelijk is en welke idempotente/gerichte DDL nodig is.

## Besluit voor de volgende fase

CRM-MIG-2A bewijst dat `vyjocdlwfxrblusfngfq` nog niet cutover-gereed is en dat een gerichte schema-opbouw nodig is.

Veilige vervolgstappen:

1. bouw een canoniek objectmanifest voor tabellen, kolommen, PK/FK, indexes, constraints, enums, views, triggers, functions/RPC en RLS/policies;
2. deel de ontbrekende architectuur op in kleine dependency-geordende migratiebundels;
3. begin met basis-enums en gedeelde CRM-objecten, niet met Off-Market schedulers of Edge Functions;
4. voer vóór iedere toekomstige DDL-handeling `npm run crm:migratie:check-target` uit met expliciet `CRM_TARGET_PROJECT_ID=vyjocdlwfxrblusfngfq`;
5. pas geen databasewijziging toe zonder aparte review en expliciete doelbevestiging;
6. behoud de oude Lovable-productie als copy-only migratiebron zodra export/read-only toegang weer beschikbaar is.

## Niet gedaan

- geen write naar `vyjoc...`;
- geen toegangsomzeiling naar `ljud...`;
- geen gebruik van Lovable-shadow;
- geen CRM-data naar BAG;
- geen schema-installatie;
- geen Edge Function-deployment;
- geen Auth- of OAuth-configuratie;
- geen Storage-mutatie;
- geen Kadaster-call;
- geen secretwijziging.
