import type {
  DispositionType,
  InterventionType,
  PropositionDefinition,
  PropositionSectionId,
  PropositionType,
  ValuationMethodId,
} from "./types";

const commonSections: PropositionSectionId[] = [
  "overview",
  "acquisition",
  "sources_and_assumptions",
  "audit",
];

function define(
  type: PropositionType,
  label: string,
  description: string,
  interventions: InterventionType[],
  dispositions: DispositionType[],
  methods: ValuationMethodId[],
  recommended: PropositionSectionId[] = ["valuation", "risks"],
): PropositionDefinition {
  return {
    type,
    label,
    description,
    sections: {
      required: commonSections,
      recommended,
      optional: [
        "income",
        "operating_costs",
        "development_costs",
        "components",
        "residential_wws",
        "residual_value",
        "sensitivity",
      ],
    },
    allowedInterventions: interventions,
    allowedDispositions: dispositions,
    leadingValuationMethods: methods,
    applicableMetricCategories: [],
    validations: [],
    schemaVersion: 1,
  };
}

export const PROPOSITION_DEFINITIONS: readonly PropositionDefinition[] = [
  define("legacy_generic", "Generiek (bestaand)", "Backward-compatible generieke propositie.", ["none", "renovate", "transform", "split", "demolish_newbuild", "rooftop_extension"], ["hold", "sell_vacant", "sell_tenanted", "sell", "defer"], ["manual_value"]),
  define("leased_investment", "Verhuurde belegging", "Waardering van verhuurd beleggingsvastgoed.", ["none", "renovate"], ["hold", "sell_tenanted", "defer"], ["rent_bar", "noi_nar", "rent_factor"]),
  define("vacant_commercial", "Leegstaand commercieel vastgoed", "Analyse van leegstaand commercieel vastgoed.", ["none", "renovate", "transform"], ["hold", "sell_vacant", "sell", "defer"], ["comparative_market", "manual_value", "scenario_exit"]),
  define("renovate_and_sell", "Renoveren en doorverkopen", "Aankoop, renovatie en verkoop.", ["renovate"], ["sell"], ["comparative_market", "scenario_exit", "residual_cost_profit", "residual_gdv_profit"], ["development_costs", "valuation", "risks"]),
  define("sell_off", "Uitponden", "Verkoop van afzonderlijke delen of eenheden.", ["none", "renovate", "split"], ["sell_vacant", "sell_tenanted", "sell"], ["comparative_market", "component_sale_value"]),
  define("transformation", "Transformatie", "Functiewijziging met ontwikkel- en exitspoor.", ["transform", "split", "renovate"], ["hold", "sell", "defer"], ["comparative_market", "scenario_exit", "residual_cost_profit", "residual_gdv_profit"]),
  define("demolition_newbuild", "Sloop/nieuwbouw", "Sloop en vervangende nieuwbouw.", ["demolish_newbuild"], ["hold", "sell", "defer"], ["scenario_exit", "residual_cost_profit", "residual_gdv_profit"]),
  define("rooftop_extension", "Optoppen", "Toevoegen van bouwvolume bovenop bestaande bouw.", ["rooftop_extension"], ["hold", "sell", "defer"], ["scenario_exit", "residual_cost_profit", "residual_gdv_profit"]),
  define("mixed_use", "Mixed-use", "Gecombineerde gebruiksfuncties en waarderingssporen.", ["none", "renovate", "transform", "split"], ["hold", "sell_vacant", "sell_tenanted", "sell", "defer"], ["comparative_market", "noi_nar", "component_sale_value", "scenario_exit"]),
  define("portfolio", "Portefeuille", "Geaggregeerde analyse van meerdere objecten.", ["none", "renovate"], ["hold", "sell_tenanted", "sell", "defer"], ["portfolio_aggregation"]),
  define("leased_hotel", "Verhuurd hotel", "Hotelvastgoed met huurovereenkomst en operatorrisico.", ["none", "renovate"], ["hold", "sell_tenanted", "defer"], ["rent_bar", "noi_nar", "exit_yield"]),
  define("operating_hotel", "Hotel inclusief exploitatie", "Hotelvastgoed met expliciete scheiding tussen vastgoed en exploitatie.", ["none", "renovate", "transform"], ["hold", "sell", "defer"], ["operating_cashflow", "exit_yield", "exit_multiple"]),
  define("land_development", "Grondontwikkeling", "Ontwikkeling van grond naar toekomstig programma.", ["transform", "demolish_newbuild"], ["hold", "sell", "defer"], ["residual_cost_profit", "residual_gdv_profit", "scenario_exit"]),
] as const;
