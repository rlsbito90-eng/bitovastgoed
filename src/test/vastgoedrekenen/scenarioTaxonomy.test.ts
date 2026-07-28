import { describe, expect, it } from 'vitest';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { buildScenarioComputeContext } from '@/lib/vastgoedrekenen/computeContext';
import { VALUATION_METHOD_IDS } from '@/lib/vastgoedrekenen/propositions/types';
import {
  BUSINESS_CASES,
  DISPOSITIONS,
  EXPANSION_SUBTYPES,
  FUTURE_VALUATION_METHOD_METADATA,
  INTERVENTIONS,
  LEGACY_STRATEGY_TAXONOMY,
  mapLegacyStrategy,
  resolveScenarioTaxonomy,
  validateComponentTiming,
  validateScenarioTaxonomy,
  type LegacyStrategyMapping,
  type LegacyStrategyType,
} from '@/lib/vastgoedrekenen/taxonomy';
import { scen } from './golden/fixtures';

const EXPECTED_LEGACY_STRATEGIES: LegacyStrategyType[] = [
  'belegging',
  'huur_optimaliseren',
  'renoveren_verhuren',
  'transformeren',
  'splitsen',
  'uitponden',
  'verkopen_geheel',
  'verkoop_per_unit',
  'bedrijfsunits_los',
  'buy_fix_hold',
  'buy_fix_sell',
  'buy_split_sell',
  'buy_transform_hold',
  'buy_transform_sell',
  'sale_leaseback',
  'herontwikkeling',
  'overig',
];

describe('canonieke Vastgoedrekenen-taxonomie', () => {
  it('dekt alle 17 legacystrategieën exhaustief en exact eenmaal', () => {
    const exhaustive: Record<LegacyStrategyType, LegacyStrategyMapping> = LEGACY_STRATEGY_TAXONOMY;
    expect(Object.keys(exhaustive).sort()).toEqual([...EXPECTED_LEGACY_STRATEGIES].sort());
    expect(new Set(Object.keys(exhaustive)).size).toBe(17);
  });

  it('houdt businesscase, ingreep, exploitatie, disposition, timing en financiering onafhankelijk', () => {
    expect(BUSINESS_CASES).not.toContain('value_add_hold');
    expect(BUSINESS_CASES).not.toContain('value_add_sell');
    expect(BUSINESS_CASES).not.toContain('redevelop_sell');

    expect(INTERVENTIONS).not.toContain('relet');
    expect(DISPOSITIONS).not.toContain('sell_as_whole_vacant');
    expect(DISPOSITIONS).not.toContain('sell_as_whole_tenanted');
    expect(DISPOSITIONS).not.toContain('refinance_and_hold');
    expect(DISPOSITIONS).not.toContain('deferred');
    expect(DISPOSITIONS).toContain('hold');
    expect(DISPOSITIONS).toContain('sell_as_whole');
    expect(DISPOSITIONS).toContain('sell_unit');

    const hold = mapLegacyStrategy('buy_fix_hold').mapping;
    const sell = mapLegacyStrategy('buy_fix_sell').mapping;
    const rentOptimization = mapLegacyStrategy('huur_optimaliseren').mapping;
    expect(hold.businessCase).toBe('value_add');
    expect(sell.businessCase).toBe('value_add');
    expect(hold.disposition).toBe('hold');
    expect(sell.disposition).toBe('sell_as_whole');
    expect(sell.exploitation).toBe('vacant');
    expect(rentOptimization.intervention).toBe('none');
  });

  it('modelleert optoppen uitsluitend als subtype van uitbreiden', () => {
    expect(EXPANSION_SUBTYPES).toContain('rooftop_addition');
    expect(INTERVENTIONS).toContain('expand');
    expect(INTERVENTIONS).not.toContain('rooftop_addition');
    expect(BUSINESS_CASES).not.toContain('rooftop_addition');
  });

  it('geeft voor uitbreiden zonder subtype een draftwaarschuwing en strikte fout', () => {
    const taxonomy = {
      businessCase: 'redevelopment' as const,
      intervention: 'expand' as const,
      expansionSubtype: null,
      exploitation: 'rental' as const,
      disposition: 'hold' as const,
    };

    const draft = validateScenarioTaxonomy(taxonomy, 'draft');
    const strict = validateScenarioTaxonomy(taxonomy, 'strict');

    expect(draft.valid).toBe(true);
    expect(draft.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'expansion_subtype_missing', severity: 'warning' }),
    ]));
    expect(strict.valid).toBe(false);
    expect(strict.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'expansion_subtype_missing', severity: 'error' }),
    ]));
  });

  it('weigert een uitbreidingstype bij een andere ingreep', () => {
    const result = validateScenarioTaxonomy({
      businessCase: 'value_add',
      intervention: 'renovate',
      expansionSubtype: 'rooftop_addition',
      exploitation: 'rental',
      disposition: 'hold',
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe('expansion_subtype_without_expansion');
  });

  it('valideert componenttiming zonder negatieve waarden of exit vóór start', () => {
    expect(validateComponentTiming({ startMonth: 0, durationMonths: 18, dispositionMonth: 24 }).valid).toBe(true);
    expect(validateComponentTiming({ startMonth: -1, durationMonths: 18, dispositionMonth: null }).valid).toBe(false);
    expect(validateComponentTiming({ startMonth: 12, durationMonths: 6, dispositionMonth: 11 }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'disposition_before_start' })]));
  });

  it('valt bij onbekende runtimewaarden veilig terug met waarschuwingen', () => {
    const result = resolveScenarioTaxonomy({
      businessCase: 'niet_bestaand',
      intervention: null,
      expansionSubtype: 'onbekend',
      exploitation: 123,
      disposition: undefined,
    });

    expect(result.value).toEqual({
      businessCase: 'legacy_generic',
      intervention: 'none',
      expansionSubtype: null,
      exploitation: 'undecided',
      disposition: 'undecided',
    });
    expect(result.warnings.length).toBeGreaterThanOrEqual(5);
  });

  it('valt bij een onbekende legacystrategie veilig terug', () => {
    const result = mapLegacyStrategy('buy_fly_sell');
    expect(result.sourceStrategy).toBeNull();
    expect(result.mapping.businessCase).toBe('legacy_generic');
    expect(result.mapping.confidence).toBe('ambiguous');
    expect(result.mapping.warnings).toHaveLength(1);
  });
});

describe('compatibiliteit met waardering en rekenkern', () => {
  it('behoudt comparative_market ongewijzigd in de bestaande waarderingsregistry', () => {
    expect(VALUATION_METHOD_IDS).toContain('comparative_market');
    expect(FUTURE_VALUATION_METHOD_METADATA.dcf_unlevered.label).toBe('DCF — unlevered');
    expect(VALUATION_METHOD_IDS).not.toContain('dcf_unlevered');
  });

  it('beïnvloedt bestaande compute-uitkomsten niet en geeft taxonomie niet door aan compute', () => {
    const context = buildScenarioComputeContext({
      scenario: scen({
        purchase_price: 1_000_000,
        asking_price: 1_100_000,
        strategy_type: 'buy_fix_sell',
      }),
      objectType: 'enkelvoudig',
      objectArea: 250,
    });

    const before = computeScenario(context);
    const taxonomy = mapLegacyStrategy('buy_fix_sell');
    const after = computeScenario(context);

    expect(after).toEqual(before);
    expect(taxonomy.mapping.businessCase).toBe('value_add');
    expect(Object.keys(context)).not.toContain('businessCase');
    expect(Object.keys(context)).not.toContain('intervention');
    expect(Object.keys(context)).not.toContain('disposition');
  });
});
