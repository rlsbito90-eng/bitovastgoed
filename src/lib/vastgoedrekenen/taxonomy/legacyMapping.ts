import type { Database } from '@/integrations/supabase/types';
import type { LegacyStrategyMapping } from './types';

export type LegacyStrategyType = Database['public']['Enums']['vr_strategy_type'];

/**
 * Eén exhaustieve bron voor de interpretatie van bestaande gecombineerde strategiecodes.
 * De mapping is adviserend en schrijft niets terug naar bestaande scenario’s.
 */
export const LEGACY_STRATEGY_TAXONOMY: Record<LegacyStrategyType, LegacyStrategyMapping> = {
  belegging: {
    businessCase: 'income_investment',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'rental',
    disposition: 'hold',
    confidence: 'exact',
    warnings: [],
  },
  huur_optimaliseren: {
    businessCase: 'value_add',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'rental',
    disposition: 'hold',
    confidence: 'inferred',
    warnings: ['Herverhuur is een commerciële actie en geen fysieke ingreep; eventuele renovatie of verduurzaming moet apart worden vastgesteld.'],
  },
  renoveren_verhuren: {
    businessCase: 'value_add',
    intervention: 'renovate',
    expansionSubtype: null,
    exploitation: 'rental',
    disposition: 'hold',
    confidence: 'exact',
    warnings: [],
  },
  transformeren: {
    businessCase: 'redevelopment',
    intervention: 'transform',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'undecided',
    confidence: 'ambiguous',
    warnings: ['De legacycode beschrijft de ingreep, maar niet de exploitatie- of exitstrategie.'],
  },
  splitsen: {
    businessCase: 'redevelopment',
    intervention: 'split',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'undecided',
    confidence: 'ambiguous',
    warnings: ['De legacycode beschrijft de ingreep, maar niet wat met de gesplitste delen gebeurt.'],
  },
  uitponden: {
    businessCase: 'portfolio_optimization',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'rental',
    disposition: 'sell_unit',
    confidence: 'inferred',
    warnings: ['Uitponden kan gefaseerd en bij mutatie plaatsvinden; timing en leeg/verhuurd verkopen moeten apart worden vastgesteld.'],
  },
  verkopen_geheel: {
    businessCase: 'asset_disposal',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'sell_as_whole',
    confidence: 'ambiguous',
    warnings: ['De verkoopvorm is bekend, maar de legacycode vermeldt niet of het object leeg of verhuurd wordt verkocht.'],
  },
  verkoop_per_unit: {
    businessCase: 'asset_disposal',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'sell_unit',
    confidence: 'inferred',
    warnings: ['De bezettingsstatus en verkoopfasering zijn niet uit de legacycode af te leiden.'],
  },
  bedrijfsunits_los: {
    businessCase: 'portfolio_optimization',
    intervention: 'split',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'sell_unit',
    confidence: 'inferred',
    warnings: ['Controleer of de bedrijfsunits juridisch en fysiek al zelfstandig zijn of nog moeten worden gesplitst.'],
  },
  buy_fix_hold: {
    businessCase: 'value_add',
    intervention: 'renovate',
    expansionSubtype: null,
    exploitation: 'rental',
    disposition: 'hold',
    confidence: 'exact',
    warnings: [],
  },
  buy_fix_sell: {
    businessCase: 'value_add',
    intervention: 'renovate',
    expansionSubtype: null,
    exploitation: 'vacant',
    disposition: 'sell_as_whole',
    confidence: 'inferred',
    warnings: ['De legacycode impliceert verkoop na renovatie, maar sluit verkoop per unit of verhuurde verkoop niet expliciet uit.'],
  },
  buy_split_sell: {
    businessCase: 'redevelopment',
    intervention: 'split',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'sell_unit',
    confidence: 'exact',
    warnings: [],
  },
  buy_transform_hold: {
    businessCase: 'redevelopment',
    intervention: 'transform',
    expansionSubtype: null,
    exploitation: 'rental',
    disposition: 'hold',
    confidence: 'exact',
    warnings: [],
  },
  buy_transform_sell: {
    businessCase: 'redevelopment',
    intervention: 'transform',
    expansionSubtype: null,
    exploitation: 'vacant',
    disposition: 'sell_as_whole',
    confidence: 'inferred',
    warnings: ['De legacycode impliceert verkoop na transformatie, maar specificeert niet of als geheel of per unit wordt verkocht.'],
  },
  sale_leaseback: {
    businessCase: 'capital_restructuring',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'rental',
    disposition: 'sale_and_leaseback',
    confidence: 'exact',
    warnings: [],
  },
  herontwikkeling: {
    businessCase: 'redevelopment',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'undecided',
    confidence: 'ambiguous',
    warnings: ['De legacycode beschrijft alleen de brede businesscase; ingreep, exploitatie en exit ontbreken.'],
  },
  overig: {
    businessCase: 'legacy_generic',
    intervention: 'none',
    expansionSubtype: null,
    exploitation: 'undecided',
    disposition: 'undecided',
    confidence: 'ambiguous',
    warnings: ['De legacystrategie “overig” vereist handmatige classificatie.'],
  },
};

export interface LegacyStrategyResolution {
  sourceStrategy: LegacyStrategyType | null;
  mapping: LegacyStrategyMapping;
}

export function isLegacyStrategyType(value: unknown): value is LegacyStrategyType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_STRATEGY_TAXONOMY, value);
}

export function mapLegacyStrategy(value: unknown): LegacyStrategyResolution {
  if (isLegacyStrategyType(value)) {
    const mapping = LEGACY_STRATEGY_TAXONOMY[value];
    return {
      sourceStrategy: value,
      mapping: { ...mapping, warnings: [...mapping.warnings] },
    };
  }

  const shown = typeof value === 'string' && value.trim() ? `“${value}”` : 'een ontbrekende waarde';
  return {
    sourceStrategy: null,
    mapping: {
      businessCase: 'legacy_generic',
      intervention: 'none',
      expansionSubtype: null,
      exploitation: 'undecided',
      disposition: 'undecided',
      confidence: 'ambiguous',
      warnings: [`Onbekende legacystrategie ${shown}; handmatige classificatie is vereist.`],
    },
  };
}
