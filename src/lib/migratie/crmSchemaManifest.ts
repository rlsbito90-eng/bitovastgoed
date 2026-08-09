export const CRM_DOELPROJECT = 'vyjocdlwfxrblusfngfq' as const;

export const BESCHERMDE_PROJECTEN = [
  'ljudxyrqoifhfikueric',
  'wzkhmjuasyuvzhhycnym',
  'xfygspvpeugxowxbcvnm',
] as const;

export type SchemaBundel = {
  id: string;
  naam: string;
  doel: string;
  tabellen: readonly string[];
  bronMigraties: readonly string[];
  afhankelijkVan: readonly string[];
  schrijftDatabase: false;
};

export const CRM_SCHEMA_BUNDELS: readonly SchemaBundel[] = [
  {
    id: '2B-1',
    naam: 'property-en-deal-classificatie',
    doel: 'Canonieke property/deal-taxonomie en koppelingen voorbereiden.',
    tabellen: ['property_types', 'property_subtypes', 'deal_types', 'property_type_aliases'],
    bronMigraties: ['20260427140858_fd240c17-724e-4d95-b671-6e1ce3c6656c.sql'],
    afhankelijkVan: [],
    schrijftDatabase: false,
  },
  {
    id: '2B-2',
    naam: 'pipelinefundament',
    doel: 'Pipelines, stages en objectpipeline als apart afhankelijkheidscluster vastleggen.',
    tabellen: ['pipelines', 'pipeline_stages', 'object_pipeline'],
    bronMigraties: [
      '20260427152752_7ce0c8b5-fa16-4093-a21d-e0cd8e8e0b67.sql',
      '20260427155927_a7ec1f1c-5d11-4e2d-9119-2965f2a68a4c.sql',
    ],
    afhankelijkVan: ['2B-1'],
    schrijftDatabase: false,
  },
  {
    id: '2B-3',
    naam: 'crm-uitbreidingen',
    doel: 'Ontbrekende CRM-object-, dossier-, contact- en biedingsstructuren voorbereiden.',
    tabellen: [
      'contact_moments', 'object_aanbiedingsteksten', 'object_aandachtspunten',
      'object_dossier_items', 'biedingen', 'kadaster_data_records', 'kadaster_documenten',
    ],
    bronMigraties: [
      '20260518194658_d3f9cfb7-a47e-4349-8a78-a33d7da42e36.sql',
      '20260521204148_3a9db3c2-b9fd-423f-9661-ae2243f7b140.sql',
      '20260522091826_5267d17d-aba7-4bc8-bf92-54aa7596fdb0.sql',
      '20260610143157_c6be5416-aa03-4dea-b871-18fd03468f87.sql',
      '20260610193256_bc6650d4-d604-4395-b430-eaaed3d07c50.sql',
    ],
    afhankelijkVan: ['2B-1', '2B-2'],
    schrijftDatabase: false,
  },
  {
    id: '2B-4',
    naam: 'vastgoedrekenen-basis',
    doel: 'Scenario-, component-, output-, kosten-, WWS- en taxfundament voorbereiden.',
    tabellen: [
      'calculation_components', 'calculation_outputs', 'calculation_scenarios', 'exit_assumptions',
      'real_estate_calculations', 'residential_wws_units', 'risk_analysis', 'scenario_costs',
      'sell_off_units', 'user_calculation_preferences', 'vastgoedrekenen_tax_settings',
    ],
    bronMigraties: ['20260519222636_ee3c0097-0ead-4f74-835b-ee1303d8846f.sql'],
    afhankelijkVan: ['2B-1'],
    schrijftDatabase: false,
  },
  {
    id: '2B-5',
    naam: 'vastgoedrekenen-uitbreidingen',
    doel: 'Kengetallen, verkrijgingsstructuur, waardering, financiering en bronimport voorbereiden.',
    tabellen: [
      'scenario_kengetal_snapshots', 'vastgoedrekenen_kengetallen',
      'calculation_acquisition_components', 'calculation_acquisition_unit_links',
      'comparative_valuation_references', 'comparative_valuations', 'scenario_financing_facilities',
      'vastgoedrekenen_taxonomie_opties', 'acquisitie_gebiedsvoorkeuren',
      'scenario_kengetal_contexts', 'scenario_kengetal_profile_applications',
      'vastgoedrekenen_bronpakketten', 'vastgoedrekenen_bronimport_runs',
      'vastgoedrekenen_bronimport_mapping_profielen',
    ],
    bronMigraties: [
      '20260723220000_vastgoedrekenen_kengetallenregister.sql',
      '20260725153000_vastgoedrekenen_verkrijgingsstructuur.sql',
      '20260728011000_vastgoedrekenen_comparative_valuation.sql',
      '20260729090000_scenario_financing_facilities.sql',
      '20260729123000_kengetallen_taxonomie_gebiedsvoorkeuren.sql',
      '20260730023000_scenario_input_profiles_f6b.sql',
      '20260730150000_source_packages_f6d1.sql',
      '20260730170000_source_import_f6d2.sql',
      '20260730193000_source_import_templates_mapping_profiles_f6d3.sql',
    ],
    afhankelijkVan: ['2B-4'],
    schrijftDatabase: false,
  },
  {
    id: '2B-6',
    naam: 'off-market-radar',
    doel: 'Off-Market opslag, import, AI-audit, Kadasterstatus, brieven en acquisitieselectie voorbereiden.',
    tabellen: [
      'off_market_bronnen', 'off_market_signalen', 'off_market_signalen_ruw', 'off_market_ai_runs',
      'off_market_kadaster_checks', 'off_market_import_runs', 'off_market_brieven',
      'off_market_brief_events', 'off_market_acquisitie_selectie',
    ],
    bronMigraties: [
      '20260602220701_b18d3bf9-7f37-425c-80c9-1590a941163e.sql',
      '20260608005452_ca3ef8be-9fe5-44d8-b435-fd08c11faded.sql',
      '20260613203446_6886b508-a82f-495f-877a-1c0a5ad90ca1.sql',
      '20260615152638_f72efb25-078f-4a48-abb9-b073296cca7a.sql',
      '20260618121548_0eaa5117-661f-46b8-9347-6ceb28c3adcc.sql',
      '20260623010835_1510b28a-21be-45f1-8846-66f8d83ae5bf.sql',
    ],
    afhankelijkVan: ['2B-1', '2B-3'],
    schrijftDatabase: false,
  },
  {
    id: '2B-7',
    naam: 'acquisitie-en-vastgoedkansen',
    doel: 'Legacy acquisitieobjecten en Vastgoedkansen pas na de onderliggende CRM/Off-Market-basis voorbereiden.',
    tabellen: ['acquisitie_campagnes', 'acquisitie_targets', 'vastgoedkansen'],
    bronMigraties: [
      '20260510212334_3ed92a2d-b99f-4417-84a0-cf63c504dc66.sql',
      '20260802040500_vastgoedkansen_e1_e2.sql',
    ],
    afhankelijkVan: ['2B-2', '2B-6'],
    schrijftDatabase: false,
  },
] as const;

export const UITGESLOTEN_VAN_EERSTE_CRM_SCHEMAOPBOUW = [
  'bag_control', 'bag_staging', 'bag_published', 'bag_service',
  'crm_objectregistraties', 'crm_objectbronkoppelingen',
  'kadaster_budgetten', 'kadaster_kosten_events', 'kadaster_producten',
] as const;
