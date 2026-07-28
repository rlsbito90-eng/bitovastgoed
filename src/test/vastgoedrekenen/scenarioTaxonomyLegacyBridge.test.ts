import { describe, expect, it } from 'vitest';
import {
  buildLegacyCompatibilityPatch,
  isLegacyCompatibilityAligned,
  suggestLegacyScenarioCompatibility,
  type CanonicalScenarioTaxonomy,
} from '@/lib/vastgoedrekenen/taxonomy';

const base: CanonicalScenarioTaxonomy = {
  businessCase: 'income_investment',
  intervention: 'none',
  expansionSubtype: null,
  exploitation: 'rental',
  disposition: 'hold',
};

describe('Vastgoedrekenen taxonomie Fase 3B — legacy rekenbridge', () => {
  it('vertaalt transformeren, verhuren en aanhouden exact', () => {
    const result = suggestLegacyScenarioCompatibility({
      ...base,
      businessCase: 'redevelopment',
      intervention: 'transform',
    });

    expect(result).toMatchObject({
      status: 'exact',
      strategyType: 'buy_transform_hold',
      saleStrategy: 'geen_verkoop',
    });
    expect(buildLegacyCompatibilityPatch({
      strategy_type: 'buy_transform_sell',
      sale_strategy: 'transformeren_verkopen',
    }, result)).toEqual({
      strategy_type: 'buy_transform_hold',
      sale_strategy: 'geen_verkoop',
    });
  });

  it('benadert transformatie met verkoop per unit zonder dit als exact te presenteren', () => {
    const result = suggestLegacyScenarioCompatibility({
      ...base,
      businessCase: 'redevelopment',
      intervention: 'transform',
      exploitation: 'vacant',
      disposition: 'sell_unit',
    });

    expect(result.status).toBe('inferred');
    expect(result.strategyType).toBe('buy_transform_sell');
    expect(result.saleStrategy).toBe('per_unit_verkopen');
    expect(result.warnings.join(' ')).toMatch(/onderscheidt verkoop als geheel en verkoop per unit niet volledig/i);
  });

  it('weigert optoppen aan een onjuiste legacystrategie te koppelen', () => {
    const result = suggestLegacyScenarioCompatibility({
      ...base,
      businessCase: 'redevelopment',
      intervention: 'expand',
      expansionSubtype: 'rooftop_addition',
    });

    expect(result.status).toBe('unsupported');
    expect(result.strategyType).toBeNull();
    expect(result.reasons.join(' ')).toMatch(/optoppen/i);
    expect(buildLegacyCompatibilityPatch({ strategy_type: 'belegging' }, result)).toEqual({});
  });

  it('koppelt uitponden aan strategie en verkoopvorm', () => {
    const result = suggestLegacyScenarioCompatibility({
      ...base,
      businessCase: 'portfolio_optimization',
      disposition: 'sell_unit',
    });

    expect(result).toMatchObject({
      status: 'exact',
      strategyType: 'uitponden',
      saleStrategy: 'uitponden',
    });
  });

  it('wijzigt uitsluitend legacyvelden die nog afwijken', () => {
    const result = suggestLegacyScenarioCompatibility(base);
    const current = { strategy_type: 'belegging', sale_strategy: 'geen_verkoop' };

    expect(buildLegacyCompatibilityPatch(current, result)).toEqual({});
    expect(isLegacyCompatibilityAligned(current, result)).toBe(true);
  });

  it('laat verkoopstrategie ongemoeid wanneer bezettingsstatus nog onbekend is', () => {
    const result = suggestLegacyScenarioCompatibility({
      ...base,
      businessCase: 'asset_disposal',
      exploitation: 'undecided',
      disposition: 'sell_as_whole',
    });

    expect(result.status).toBe('inferred');
    expect(result.strategyType).toBe('verkopen_geheel');
    expect(result.saleStrategy).toBeNull();
    expect(buildLegacyCompatibilityPatch({
      strategy_type: 'belegging',
      sale_strategy: 'verhuurd_verkopen',
    }, result)).toEqual({ strategy_type: 'verkopen_geheel' });
  });
});
