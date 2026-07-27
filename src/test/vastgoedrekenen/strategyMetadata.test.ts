import { describe, expect, it } from 'vitest';
import {
  COMPONENT_STRATEGY_METADATA,
  HOLD_STRATEGIES,
  SALE_STRATEGIES,
  isHoldStrategy,
  isSaleStrategy,
  isTransformationStrategy,
  type ComponentStrategyKey,
} from '@/lib/vastgoedrekenen/componentStrategy';
import { detectCaseType } from '@/lib/vastgoedrekenen/validation/caseRequirements';
import { scen, unit } from './golden/fixtures';

function detectStrategy(strategy: ComponentStrategyKey) {
  return detectCaseType(
    scen({ strategy_type: '' }),
    [],
    [unit({ strategy })],
    'enkelvoudig',
  );
}

describe('centrale componentstrategiemetadata', () => {
  it('leidt verkoop- en aanhoudlijsten af uit één metadataregistratie', () => {
    const entries = Object.entries(COMPONENT_STRATEGY_METADATA) as Array<
      [ComponentStrategyKey, (typeof COMPONENT_STRATEGY_METADATA)[ComponentStrategyKey]]
    >;

    expect(SALE_STRATEGIES).toEqual(
      entries
        .filter(([, metadata]) => metadata.disposition === 'sale')
        .map(([strategy]) => strategy),
    );
    expect(HOLD_STRATEGIES).toEqual(
      entries
        .filter(([, metadata]) => metadata.disposition === 'hold')
        .map(([strategy]) => strategy),
    );

    for (const [strategy, metadata] of entries) {
      expect(isSaleStrategy(strategy)).toBe(metadata.disposition === 'sale');
      expect(isHoldStrategy(strategy)).toBe(metadata.disposition === 'hold');
      expect(isTransformationStrategy(strategy)).toBe(metadata.transformation);
      expect(metadata.label.length).toBeGreaterThan(0);
    }
  });

  it.each([
    'transformeren_verkopen',
    'sloop_nieuwbouw_verkopen',
  ] satisfies ComponentStrategyKey[])(
    'detecteert %s als transformatie-verkoop',
    (strategy) => {
      expect(detectStrategy(strategy)).toBe('transformatie_verkoop');
    },
  );

  it.each([
    'transformeren_aanhouden',
    'sloop_nieuwbouw_aanhouden',
  ] satisfies ComponentStrategyKey[])(
    'detecteert %s als transformatie-verhuur',
    (strategy) => {
      expect(detectStrategy(strategy)).toBe('transformatie_verhuur');
    },
  );

  it('houdt reguliere verkoop- en aanhoudstrategieën buiten transformatie', () => {
    expect(detectStrategy('verkopen_leeg')).toBe('uitponden');
    expect(detectStrategy('renoveren_verkopen')).toBe('uitponden');
    expect(detectStrategy('aanhouden')).toBe('alles_houden');
    expect(detectStrategy('renoveren_aanhouden')).toBe('alles_houden');
  });

  it('classificeert handmatige waardering en later beslissen niet als verkoop of aanhouden', () => {
    for (const strategy of ['handmatige_waarde', 'later_beslissen'] as const) {
      expect(isSaleStrategy(strategy)).toBe(false);
      expect(isHoldStrategy(strategy)).toBe(false);
      expect(isTransformationStrategy(strategy)).toBe(false);
    }
  });

  it('houdt historische scenario-enums voor transformatie werkend', () => {
    expect(detectCaseType(
      scen({ strategy_type: 'buy_transform_sell' }),
      [],
      [],
      'enkelvoudig',
    )).toBe('transformatie_verkoop');
    expect(detectCaseType(
      scen({ strategy_type: 'buy_transform_hold' }),
      [],
      [],
      'enkelvoudig',
    )).toBe('transformatie_verhuur');
  });
});
